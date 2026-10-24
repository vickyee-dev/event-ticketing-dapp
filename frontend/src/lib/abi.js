// Human-readable ABI for contracts/EventTicketing.sol (ethers v6 parses this directly).
// Keep in sync with the contract: struct field order matters.
const EVENT_TUPLE =
  "tuple(address organizer, uint64 startTime, uint128 price, uint32 capacity, uint32 sold, uint32 maxPerWallet, bool cancelled, string name, string venue)";
const TICKET_TUPLE = "tuple(uint256 eventId, address owner, uint64 purchasedAt, bool checkedIn)";

export const ABI = [
  // reads
  "function eventCount() view returns (uint256)",
  "function ticketCount() view returns (uint256)",
  `function getEvent(uint256 eventId) view returns (${EVENT_TUPLE})`,
  `function getEvents(uint256 offset, uint256 limit) view returns (${EVENT_TUPLE}[])`,
  `function getTicket(uint256 ticketId) view returns (${TICKET_TUPLE})`,
  "function ticketsOf(address owner) view returns (uint256[])",
  "function escrow(uint256 eventId) view returns (uint256)",
  "function purchased(uint256 eventId, address buyer) view returns (uint32)",
  "function isScanner(uint256 eventId, address scanner) view returns (bool)",

  // writes
  "function createEvent(string name, string venue, uint64 startTime, uint128 price, uint32 capacity, uint32 maxPerWallet) returns (uint256)",
  "function buyTickets(uint256 eventId, uint32 quantity) payable",
  "function transferTicket(uint256 ticketId, address to)",
  "function refund(uint256 ticketId)",
  "function cancelEvent(uint256 eventId)",
  "function setScanner(uint256 eventId, address scanner, bool allowed)",
  "function withdrawProceeds(uint256 eventId)",
  "function checkIn(uint256 ticketId)",

  // custom errors (lets ethers decode reverts into readable names)
  "error EventNotFound()",
  "error TicketNotFound()",
  "error NotOrganizer()",
  "error NotTicketOwner()",
  "error NotAuthorizedScanner()",
  "error InvalidParameters()",
  "error StartInPast()",
  "error ZeroQuantity()",
  "error SoldOut()",
  "error WalletLimitReached()",
  "error WrongPayment()",
  "error SalesClosed()",
  "error EventIsCancelled()",
  "error EventNotCancelled()",
  "error EventNotStarted()",
  "error EventAlreadyStarted()",
  "error AlreadyCheckedIn()",
  "error InvalidRecipient()",
  "error NothingToWithdraw()",
  "error TransferFailed()",
  "error Reentrancy()",
];
