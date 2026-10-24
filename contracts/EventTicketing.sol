// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EventTicketing
/// @notice Multi-event ticketing on an EVM chain (built for Avalanche C-Chain).
///         Organizers create events, attendees buy tickets with the native token,
///         tickets can be transferred, checked in at the door, and refunded if
///         the event is cancelled.
/// @dev    Funds are held in escrow per event. Organizers can only withdraw once
///         the event has started and has not been cancelled, so buyers are never
///         exposed to an organizer who takes the money and cancels. Payouts and
///         refunds use a reentrancy guard and update state before sending funds.
contract EventTicketing {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    struct EventInfo {
        address organizer;
        uint64 startTime; // unix seconds
        uint128 price; // wei per ticket
        uint32 capacity;
        uint32 sold;
        uint32 maxPerWallet;
        bool cancelled;
        string name;
        string venue;
    }

    struct Ticket {
        uint256 eventId;
        address owner;
        uint64 purchasedAt;
        bool checkedIn;
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    uint256 public constant MAX_TEXT_LENGTH = 100;

    /// @notice Number of events ever created. Event ids run from 1 to eventCount.
    uint256 public eventCount;
    /// @notice Number of tickets ever minted. Ticket ids run from 1 to ticketCount.
    uint256 public ticketCount;

    /// @notice Funds held for an event (ticket sales minus refunds minus withdrawals).
    mapping(uint256 => uint256) public escrow;
    /// @notice Tickets bought by a wallet for an event (used to enforce maxPerWallet).
    mapping(uint256 => mapping(address => uint32)) public purchased;
    /// @notice Wallets (besides the organizer) allowed to check tickets in.
    mapping(uint256 => mapping(address => bool)) public isScanner;

    mapping(uint256 => EventInfo) private _events;
    mapping(uint256 => Ticket) private _tickets;
    mapping(address => uint256[]) private _owned;
    mapping(uint256 => uint256) private _ownedIndex;

    uint256 private _locked = 1;

    /*//////////////////////////////////////////////////////////////
                             EVENTS & ERRORS
    //////////////////////////////////////////////////////////////*/

    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        string name,
        uint64 startTime,
        uint128 price,
        uint32 capacity
    );
    event TicketsPurchased(
        uint256 indexed eventId,
        address indexed buyer,
        uint256 firstTicketId,
        uint32 quantity
    );
    event TicketTransferred(uint256 indexed ticketId, address indexed from, address indexed to);
    event TicketCheckedIn(uint256 indexed ticketId, uint256 indexed eventId, address indexed scanner);
    event EventCancelled(uint256 indexed eventId);
    event TicketRefunded(
        uint256 indexed ticketId,
        uint256 indexed eventId,
        address indexed owner,
        uint256 amount
    );
    event ProceedsWithdrawn(uint256 indexed eventId, address indexed organizer, uint256 amount);
    event ScannerUpdated(uint256 indexed eventId, address indexed scanner, bool allowed);

    error EventNotFound();
    error TicketNotFound();
    error NotOrganizer();
    error NotTicketOwner();
    error NotAuthorizedScanner();
    error InvalidParameters();
    error StartInPast();
    error ZeroQuantity();
    error SoldOut();
    error WalletLimitReached();
    error WrongPayment();
    error SalesClosed();
    error EventIsCancelled();
    error EventNotCancelled();
    error EventNotStarted();
    error EventAlreadyStarted();
    error AlreadyCheckedIn();
    error InvalidRecipient();
    error NothingToWithdraw();
    error TransferFailed();
    error Reentrancy();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier nonReentrant() {
        if (_locked == 2) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    /*//////////////////////////////////////////////////////////////
                            ORGANIZER ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a new event. The caller becomes its organizer.
    /// @param name Display name (1-100 bytes).
    /// @param venue Venue or location (0-100 bytes).
    /// @param startTime Unix timestamp when the event starts. Sales close at this time.
    /// @param price Price per ticket in wei. Zero creates a free event.
    /// @param capacity Total number of tickets (at least 1).
    /// @param maxPerWallet Maximum tickets one wallet may buy (1 to capacity).
    function createEvent(
        string calldata name,
        string calldata venue,
        uint64 startTime,
        uint128 price,
        uint32 capacity,
        uint32 maxPerWallet
    ) external returns (uint256 eventId) {
        uint256 nameLength = bytes(name).length;
        if (nameLength == 0 || nameLength > MAX_TEXT_LENGTH) revert InvalidParameters();
        if (bytes(venue).length > MAX_TEXT_LENGTH) revert InvalidParameters();
        if (startTime <= block.timestamp) revert StartInPast();
        if (capacity == 0 || maxPerWallet == 0 || maxPerWallet > capacity) revert InvalidParameters();

        eventId = ++eventCount;
        EventInfo storage ev = _events[eventId];
        ev.organizer = msg.sender;
        ev.startTime = startTime;
        ev.price = price;
        ev.capacity = capacity;
        ev.maxPerWallet = maxPerWallet;
        ev.name = name;
        ev.venue = venue;

        emit EventCreated(eventId, msg.sender, name, startTime, price, capacity);
    }

    /// @notice Cancel an event that has not started. Ticket holders can then claim refunds.
    function cancelEvent(uint256 eventId) external {
        EventInfo storage ev = _event(eventId);
        if (msg.sender != ev.organizer) revert NotOrganizer();
        if (ev.cancelled) revert EventIsCancelled();
        if (block.timestamp >= ev.startTime) revert EventAlreadyStarted();

        ev.cancelled = true;
        emit EventCancelled(eventId);
    }

    /// @notice Allow or revoke a wallet's permission to check tickets in for an event.
    function setScanner(uint256 eventId, address scanner, bool allowed) external {
        EventInfo storage ev = _event(eventId);
        if (msg.sender != ev.organizer) revert NotOrganizer();
        if (scanner == address(0)) revert InvalidRecipient();

        isScanner[eventId][scanner] = allowed;
        emit ScannerUpdated(eventId, scanner, allowed);
    }

    /// @notice Withdraw all escrowed sales for an event to the organizer.
    /// @dev Only possible once the event has started and only if it was not cancelled.
    function withdrawProceeds(uint256 eventId) external nonReentrant {
        EventInfo storage ev = _event(eventId);
        if (msg.sender != ev.organizer) revert NotOrganizer();
        if (ev.cancelled) revert EventIsCancelled();
        if (block.timestamp < ev.startTime) revert EventNotStarted();

        uint256 amount = escrow[eventId];
        if (amount == 0) revert NothingToWithdraw();

        escrow[eventId] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit ProceedsWithdrawn(eventId, msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                             ATTENDEE ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Buy one or more tickets. `msg.value` must equal price * quantity exactly.
    function buyTickets(uint256 eventId, uint32 quantity) external payable {
        EventInfo storage ev = _event(eventId);
        if (ev.cancelled) revert EventIsCancelled();
        if (block.timestamp >= ev.startTime) revert SalesClosed();
        if (quantity == 0) revert ZeroQuantity();
        if (uint256(ev.sold) + quantity > ev.capacity) revert SoldOut();
        if (uint256(purchased[eventId][msg.sender]) + quantity > ev.maxPerWallet) {
            revert WalletLimitReached();
        }
        if (msg.value != uint256(ev.price) * quantity) revert WrongPayment();

        ev.sold += quantity;
        purchased[eventId][msg.sender] += quantity;
        escrow[eventId] += msg.value;

        uint256 firstTicketId = ticketCount + 1;
        for (uint32 i = 0; i < quantity; i++) {
            uint256 ticketId = ++ticketCount;
            _tickets[ticketId] = Ticket({
                eventId: eventId,
                owner: msg.sender,
                purchasedAt: uint64(block.timestamp),
                checkedIn: false
            });
            _addToOwner(msg.sender, ticketId);
        }

        emit TicketsPurchased(eventId, msg.sender, firstTicketId, quantity);
    }

    /// @notice Transfer a ticket to another wallet. Used tickets cannot be transferred.
    function transferTicket(uint256 ticketId, address to) external {
        Ticket storage t = _ticket(ticketId);
        if (msg.sender != t.owner) revert NotTicketOwner();
        if (to == address(0) || to == msg.sender) revert InvalidRecipient();
        if (t.checkedIn) revert AlreadyCheckedIn();
        if (_events[t.eventId].cancelled) revert EventIsCancelled();

        _removeFromOwner(msg.sender, ticketId);
        t.owner = to;
        _addToOwner(to, ticketId);

        emit TicketTransferred(ticketId, msg.sender, to);
    }

    /// @notice Refund a ticket for a cancelled event. The ticket is burned.
    function refund(uint256 ticketId) external nonReentrant {
        Ticket storage t = _ticket(ticketId);
        if (msg.sender != t.owner) revert NotTicketOwner();

        uint256 eventId = t.eventId;
        EventInfo storage ev = _events[eventId];
        if (!ev.cancelled) revert EventNotCancelled();

        uint256 amount = ev.price;

        _removeFromOwner(msg.sender, ticketId);
        delete _tickets[ticketId];
        escrow[eventId] -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit TicketRefunded(ticketId, eventId, msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                               CHECK-IN
    //////////////////////////////////////////////////////////////*/

    /// @notice Mark a ticket as used. Callable by the organizer or an approved scanner.
    function checkIn(uint256 ticketId) external {
        Ticket storage t = _ticket(ticketId);
        EventInfo storage ev = _events[t.eventId];
        if (msg.sender != ev.organizer && !isScanner[t.eventId][msg.sender]) {
            revert NotAuthorizedScanner();
        }
        if (ev.cancelled) revert EventIsCancelled();
        if (t.checkedIn) revert AlreadyCheckedIn();

        t.checkedIn = true;
        emit TicketCheckedIn(ticketId, t.eventId, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function getEvent(uint256 eventId) external view returns (EventInfo memory) {
        return _event(eventId);
    }

    /// @notice Paginated list of events. Returned entry `i` has event id `offset + i + 1`.
    function getEvents(uint256 offset, uint256 limit) external view returns (EventInfo[] memory page) {
        uint256 total = eventCount;
        if (offset >= total) return new EventInfo[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        page = new EventInfo[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = _events[i + 1];
        }
    }

    function getTicket(uint256 ticketId) external view returns (Ticket memory) {
        return _ticket(ticketId);
    }

    /// @notice Ids of all tickets currently owned by `owner`.
    function ticketsOf(address owner) external view returns (uint256[] memory) {
        return _owned[owner];
    }

    /*//////////////////////////////////////////////////////////////
                               INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _event(uint256 eventId) private view returns (EventInfo storage ev) {
        if (eventId == 0 || eventId > eventCount) revert EventNotFound();
        ev = _events[eventId];
    }

    function _ticket(uint256 ticketId) private view returns (Ticket storage t) {
        t = _tickets[ticketId];
        if (t.owner == address(0)) revert TicketNotFound();
    }

    function _addToOwner(address to, uint256 ticketId) private {
        _ownedIndex[ticketId] = _owned[to].length;
        _owned[to].push(ticketId);
    }

    function _removeFromOwner(address from, uint256 ticketId) private {
        uint256[] storage list = _owned[from];
        uint256 index = _ownedIndex[ticketId];
        uint256 lastId = list[list.length - 1];

        list[index] = lastId;
        _ownedIndex[lastId] = index;
        list.pop();
        delete _ownedIndex[ticketId];
    }
}
