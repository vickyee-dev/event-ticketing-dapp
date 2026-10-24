const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const PRICE = ethers.parseEther("0.1");
const DAY = 24 * 60 * 60;

async function deployFixture() {
  const [organizer, alice, bob, scanner, stranger] = await ethers.getSigners();
  const contract = await (await ethers.getContractFactory("EventTicketing")).deploy();
  await contract.waitForDeployment();

  const startTime = (await time.latest()) + 7 * DAY;
  await contract.createEvent("Summit", "Nairobi", startTime, PRICE, 10, 4);

  return { contract, organizer, alice, bob, scanner, stranger, startTime };
}

describe("EventTicketing", function () {
  describe("createEvent", function () {
    it("stores the event and emits EventCreated", async function () {
      const { contract, organizer } = await loadFixture(deployFixture);
      const startTime = (await time.latest()) + DAY;

      await expect(contract.createEvent("Meetup", "iHub", startTime, 0, 5, 1))
        .to.emit(contract, "EventCreated")
        .withArgs(2, organizer.address, "Meetup", startTime, 0, 5);

      const ev = await contract.getEvent(2);
      expect(ev.organizer).to.equal(organizer.address);
      expect(ev.name).to.equal("Meetup");
      expect(ev.venue).to.equal("iHub");
      expect(ev.capacity).to.equal(5);
      expect(ev.sold).to.equal(0);
      expect(ev.cancelled).to.equal(false);
      expect(await contract.eventCount()).to.equal(2);
    });

    it("rejects invalid parameters", async function () {
      const { contract } = await loadFixture(deployFixture);
      const future = (await time.latest()) + DAY;

      await expect(contract.createEvent("", "x", future, PRICE, 10, 1))
        .to.be.revertedWithCustomError(contract, "InvalidParameters");
      await expect(contract.createEvent("x".repeat(101), "x", future, PRICE, 10, 1))
        .to.be.revertedWithCustomError(contract, "InvalidParameters");
      await expect(contract.createEvent("x", "v".repeat(101), future, PRICE, 10, 1))
        .to.be.revertedWithCustomError(contract, "InvalidParameters");
      await expect(contract.createEvent("x", "v", future, PRICE, 0, 1))
        .to.be.revertedWithCustomError(contract, "InvalidParameters");
      await expect(contract.createEvent("x", "v", future, PRICE, 10, 0))
        .to.be.revertedWithCustomError(contract, "InvalidParameters");
      await expect(contract.createEvent("x", "v", future, PRICE, 10, 11))
        .to.be.revertedWithCustomError(contract, "InvalidParameters");
    });

    it("rejects a start time in the past", async function () {
      const { contract } = await loadFixture(deployFixture);
      const past = (await time.latest()) - 10;
      await expect(contract.createEvent("x", "v", past, PRICE, 10, 1))
        .to.be.revertedWithCustomError(contract, "StartInPast");
    });
  });

  describe("buyTickets", function () {
    it("mints tickets, tracks ownership and escrows the payment", async function () {
      const { contract, alice } = await loadFixture(deployFixture);

      await expect(contract.connect(alice).buyTickets(1, 3, { value: PRICE * 3n }))
        .to.emit(contract, "TicketsPurchased")
        .withArgs(1, alice.address, 1, 3);

      expect(await contract.ticketCount()).to.equal(3);
      expect((await contract.getEvent(1)).sold).to.equal(3);
      expect(await contract.escrow(1)).to.equal(PRICE * 3n);
      expect(await contract.purchased(1, alice.address)).to.equal(3);
      expect((await contract.ticketsOf(alice.address)).map(Number)).to.deep.equal([1, 2, 3]);

      const ticket = await contract.getTicket(2);
      expect(ticket.eventId).to.equal(1);
      expect(ticket.owner).to.equal(alice.address);
      expect(ticket.checkedIn).to.equal(false);
    });

    it("moves funds from the buyer into the contract", async function () {
      const { contract, alice } = await loadFixture(deployFixture);
      const address = await contract.getAddress();
      await expect(
        contract.connect(alice).buyTickets(1, 2, { value: PRICE * 2n })
      ).to.changeEtherBalances([alice, address], [-PRICE * 2n, PRICE * 2n]);
    });

    it("requires the exact payment", async function () {
      const { contract, alice } = await loadFixture(deployFixture);
      await expect(contract.connect(alice).buyTickets(1, 2, { value: PRICE }))
        .to.be.revertedWithCustomError(contract, "WrongPayment");
      await expect(contract.connect(alice).buyTickets(1, 1, { value: PRICE * 2n }))
        .to.be.revertedWithCustomError(contract, "WrongPayment");
    });

    it("rejects zero quantity and unknown events", async function () {
      const { contract, alice } = await loadFixture(deployFixture);
      await expect(contract.connect(alice).buyTickets(1, 0))
        .to.be.revertedWithCustomError(contract, "ZeroQuantity");
      await expect(contract.connect(alice).buyTickets(0, 1, { value: PRICE }))
        .to.be.revertedWithCustomError(contract, "EventNotFound");
      await expect(contract.connect(alice).buyTickets(99, 1, { value: PRICE }))
        .to.be.revertedWithCustomError(contract, "EventNotFound");
    });

    it("enforces the per-wallet limit across purchases", async function () {
      const { contract, alice } = await loadFixture(deployFixture);
      await contract.connect(alice).buyTickets(1, 3, { value: PRICE * 3n });
      await expect(contract.connect(alice).buyTickets(1, 2, { value: PRICE * 2n }))
        .to.be.revertedWithCustomError(contract, "WalletLimitReached");
      await contract.connect(alice).buyTickets(1, 1, { value: PRICE });
    });

    it("stops selling at capacity", async function () {
      const { contract, alice, bob, scanner } = await loadFixture(deployFixture);
      await contract.connect(alice).buyTickets(1, 4, { value: PRICE * 4n });
      await contract.connect(bob).buyTickets(1, 4, { value: PRICE * 4n });
      await contract.connect(scanner).buyTickets(1, 2, { value: PRICE * 2n });
      await expect(contract.buyTickets(1, 1, { value: PRICE }))
        .to.be.revertedWithCustomError(contract, "SoldOut");
    });

    it("supports free events", async function () {
      const { contract, alice } = await loadFixture(deployFixture);
      const start = (await time.latest()) + DAY;
      await contract.createEvent("Free", "", start, 0, 5, 1);
      await contract.connect(alice).buyTickets(2, 1);
      expect(await contract.escrow(2)).to.equal(0);
      expect((await contract.ticketsOf(alice.address)).length).to.equal(1);
    });

    it("closes sales once the event starts", async function () {
      const { contract, alice, startTime } = await loadFixture(deployFixture);
      await time.increaseTo(startTime);
      await expect(contract.connect(alice).buyTickets(1, 1, { value: PRICE }))
        .to.be.revertedWithCustomError(contract, "SalesClosed");
    });

    it("rejects purchases for cancelled events", async function () {
      const { contract, alice } = await loadFixture(deployFixture);
      await contract.cancelEvent(1);
      await expect(contract.connect(alice).buyTickets(1, 1, { value: PRICE }))
        .to.be.revertedWithCustomError(contract, "EventIsCancelled");
    });
  });

  describe("transferTicket", function () {
    async function withTickets() {
      const base = await deployFixture();
      await base.contract.connect(base.alice).buyTickets(1, 3, { value: PRICE * 3n });
      return base;
    }

    it("moves ownership and keeps the owner lists consistent", async function () {
      const { contract, alice, bob } = await loadFixture(withTickets);

      await expect(contract.connect(alice).transferTicket(1, bob.address))
        .to.emit(contract, "TicketTransferred")
        .withArgs(1, alice.address, bob.address);

      expect((await contract.getTicket(1)).owner).to.equal(bob.address);
      expect((await contract.ticketsOf(bob.address)).map(Number)).to.deep.equal([1]);
      // swap-and-pop moved ticket 3 into slot 0
      expect((await contract.ticketsOf(alice.address)).map(Number)).to.deep.equal([3, 2]);

      await contract.connect(alice).transferTicket(2, bob.address);
      await contract.connect(alice).transferTicket(3, bob.address);
      expect((await contract.ticketsOf(alice.address)).length).to.equal(0);
      expect((await contract.ticketsOf(bob.address)).map(Number)).to.deep.equal([1, 2, 3]);
    });

    it("only lets the owner transfer", async function () {
      const { contract, bob, stranger } = await loadFixture(withTickets);
      await expect(contract.connect(stranger).transferTicket(1, bob.address))
        .to.be.revertedWithCustomError(contract, "NotTicketOwner");
    });

    it("rejects invalid recipients", async function () {
      const { contract, alice } = await loadFixture(withTickets);
      await expect(contract.connect(alice).transferTicket(1, ethers.ZeroAddress))
        .to.be.revertedWithCustomError(contract, "InvalidRecipient");
      await expect(contract.connect(alice).transferTicket(1, alice.address))
        .to.be.revertedWithCustomError(contract, "InvalidRecipient");
    });

    it("blocks transfers of used tickets", async function () {
      const { contract, alice, bob } = await loadFixture(withTickets);
      await contract.checkIn(1);
      await expect(contract.connect(alice).transferTicket(1, bob.address))
        .to.be.revertedWithCustomError(contract, "AlreadyCheckedIn");
    });

    it("blocks transfers once the event is cancelled", async function () {
      const { contract, alice, bob } = await loadFixture(withTickets);
      await contract.cancelEvent(1);
      await expect(contract.connect(alice).transferTicket(1, bob.address))
        .to.be.revertedWithCustomError(contract, "EventIsCancelled");
    });

    it("does not raise the recipient's purchase allowance", async function () {
      const { contract, alice, bob } = await loadFixture(withTickets);
      await contract.connect(alice).transferTicket(1, bob.address);
      expect(await contract.purchased(1, bob.address)).to.equal(0);
    });
  });

  describe("checkIn and scanners", function () {
    async function withTicket() {
      const base = await deployFixture();
      await base.contract.connect(base.alice).buyTickets(1, 1, { value: PRICE });
      return base;
    }

    it("lets the organizer check a ticket in exactly once", async function () {
      const { contract, organizer } = await loadFixture(withTicket);
      await expect(contract.checkIn(1))
        .to.emit(contract, "TicketCheckedIn")
        .withArgs(1, 1, organizer.address);
      expect((await contract.getTicket(1)).checkedIn).to.equal(true);
      await expect(contract.checkIn(1))
        .to.be.revertedWithCustomError(contract, "AlreadyCheckedIn");
    });

    it("rejects check-in from unauthorized wallets", async function () {
      const { contract, alice, stranger } = await loadFixture(withTicket);
      await expect(contract.connect(stranger).checkIn(1))
        .to.be.revertedWithCustomError(contract, "NotAuthorizedScanner");
      // owning the ticket is not enough
      await expect(contract.connect(alice).checkIn(1))
        .to.be.revertedWithCustomError(contract, "NotAuthorizedScanner");
    });

    it("lets the organizer add and remove scanners", async function () {
      const { contract, scanner, stranger } = await loadFixture(withTicket);

      await expect(contract.setScanner(1, scanner.address, true))
        .to.emit(contract, "ScannerUpdated")
        .withArgs(1, scanner.address, true);
      await contract.connect(scanner).checkIn(1);

      await contract.setScanner(1, scanner.address, false);
      expect(await contract.isScanner(1, scanner.address)).to.equal(false);

      await expect(contract.connect(stranger).setScanner(1, stranger.address, true))
        .to.be.revertedWithCustomError(contract, "NotOrganizer");
      await expect(contract.setScanner(1, ethers.ZeroAddress, true))
        .to.be.revertedWithCustomError(contract, "InvalidRecipient");
    });

    it("scopes scanners to a single event", async function () {
      const { contract, alice, scanner } = await loadFixture(withTicket);
      const start = (await time.latest()) + DAY;
      await contract.createEvent("Other", "", start, PRICE, 5, 1);
      await contract.connect(alice).buyTickets(2, 1, { value: PRICE });

      await contract.setScanner(1, scanner.address, true);
      await expect(contract.connect(scanner).checkIn(2))
        .to.be.revertedWithCustomError(contract, "NotAuthorizedScanner");
    });

    it("rejects unknown tickets", async function () {
      const { contract } = await loadFixture(withTicket);
      await expect(contract.checkIn(42))
        .to.be.revertedWithCustomError(contract, "TicketNotFound");
    });
  });

  describe("cancelEvent and refund", function () {
    async function withSales() {
      const base = await deployFixture();
      await base.contract.connect(base.alice).buyTickets(1, 2, { value: PRICE * 2n });
      await base.contract.connect(base.bob).buyTickets(1, 1, { value: PRICE });
      return base;
    }

    it("only lets the organizer cancel, and only before the start", async function () {
      const { contract, stranger, startTime } = await loadFixture(withSales);
      await expect(contract.connect(stranger).cancelEvent(1))
        .to.be.revertedWithCustomError(contract, "NotOrganizer");

      await expect(contract.cancelEvent(1)).to.emit(contract, "EventCancelled").withArgs(1);
      await expect(contract.cancelEvent(1))
        .to.be.revertedWithCustomError(contract, "EventIsCancelled");

      const start = startTime + DAY;
      await contract.createEvent("Later", "", start, PRICE, 5, 1);
      await time.increaseTo(start);
      await expect(contract.cancelEvent(2))
        .to.be.revertedWithCustomError(contract, "EventAlreadyStarted");
    });

    it("refunds ticket owners and burns the ticket", async function () {
      const { contract, alice } = await loadFixture(withSales);
      await contract.cancelEvent(1);

      await expect(contract.connect(alice).refund(1))
        .to.emit(contract, "TicketRefunded")
        .withArgs(1, 1, alice.address, PRICE);

      expect(await contract.escrow(1)).to.equal(PRICE * 2n);
      expect((await contract.ticketsOf(alice.address)).map(Number)).to.deep.equal([2]);
      await expect(contract.getTicket(1))
        .to.be.revertedWithCustomError(contract, "TicketNotFound");
      await expect(contract.connect(alice).refund(1))
        .to.be.revertedWithCustomError(contract, "TicketNotFound");
    });

    it("pays the refund to the owner", async function () {
      const { contract, alice } = await loadFixture(withSales);
      await contract.cancelEvent(1);
      await expect(contract.connect(alice).refund(1)).to.changeEtherBalances(
        [alice, await contract.getAddress()],
        [PRICE, -PRICE]
      );
    });

    it("refunds whoever holds the ticket after a transfer", async function () {
      const { contract, alice, stranger } = await loadFixture(withSales);
      await contract.connect(alice).transferTicket(1, stranger.address);
      await contract.cancelEvent(1);

      await expect(contract.connect(alice).refund(1))
        .to.be.revertedWithCustomError(contract, "NotTicketOwner");
      await expect(contract.connect(stranger).refund(1)).to.changeEtherBalance(
        stranger,
        PRICE
      );
    });

    it("rejects refunds for events that are not cancelled", async function () {
      const { contract, alice } = await loadFixture(withSales);
      await expect(contract.connect(alice).refund(1))
        .to.be.revertedWithCustomError(contract, "EventNotCancelled");
    });

    it("lets every buyer be refunded in full", async function () {
      const { contract, alice, bob } = await loadFixture(withSales);
      await contract.cancelEvent(1);
      await contract.connect(alice).refund(1);
      await contract.connect(alice).refund(2);
      await contract.connect(bob).refund(3);
      expect(await contract.escrow(1)).to.equal(0);
      expect(await ethers.provider.getBalance(await contract.getAddress())).to.equal(0);
    });

    it("blocks check-in for cancelled events", async function () {
      const { contract } = await loadFixture(withSales);
      await contract.cancelEvent(1);
      await expect(contract.checkIn(1))
        .to.be.revertedWithCustomError(contract, "EventIsCancelled");
    });
  });

  describe("withdrawProceeds", function () {
    async function withSales() {
      const base = await deployFixture();
      await base.contract.connect(base.alice).buyTickets(1, 3, { value: PRICE * 3n });
      return base;
    }

    it("is locked until the event starts", async function () {
      const { contract } = await loadFixture(withSales);
      await expect(contract.withdrawProceeds(1))
        .to.be.revertedWithCustomError(contract, "EventNotStarted");
    });

    it("pays the organizer once the event has started", async function () {
      const { contract, organizer, startTime } = await loadFixture(withSales);
      await time.increaseTo(startTime);

      await expect(contract.withdrawProceeds(1)).to.changeEtherBalances(
        [organizer, await contract.getAddress()],
        [PRICE * 3n, -PRICE * 3n]
      );
      expect(await contract.escrow(1)).to.equal(0);
      await expect(contract.withdrawProceeds(1))
        .to.be.revertedWithCustomError(contract, "NothingToWithdraw");
    });

    it("only lets the organizer withdraw", async function () {
      const { contract, stranger, startTime } = await loadFixture(withSales);
      await time.increaseTo(startTime);
      await expect(contract.connect(stranger).withdrawProceeds(1))
        .to.be.revertedWithCustomError(contract, "NotOrganizer");
    });

    it("never pays out a cancelled event", async function () {
      const { contract } = await loadFixture(withSales);
      await contract.cancelEvent(1);
      await expect(contract.withdrawProceeds(1))
        .to.be.revertedWithCustomError(contract, "EventIsCancelled");
    });

    it("keeps each event's funds separate", async function () {
      const { contract, alice, organizer, startTime } = await loadFixture(withSales);
      const later = startTime + 30 * DAY;
      await contract.createEvent("Later", "", later, PRICE, 5, 5);
      await contract.connect(alice).buyTickets(2, 2, { value: PRICE * 2n });

      await time.increaseTo(startTime);
      await expect(contract.withdrawProceeds(1)).to.changeEtherBalance(organizer, PRICE * 3n);
      expect(await contract.escrow(2)).to.equal(PRICE * 2n);
      expect(await ethers.provider.getBalance(await contract.getAddress())).to.equal(PRICE * 2n);
    });
  });

  describe("views", function () {
    it("paginates events", async function () {
      const { contract } = await loadFixture(deployFixture);
      const start = (await time.latest()) + DAY;
      await contract.createEvent("Two", "", start, PRICE, 5, 1);
      await contract.createEvent("Three", "", start, PRICE, 5, 1);

      const all = await contract.getEvents(0, 10);
      expect(all.map((e) => e.name)).to.deep.equal(["Summit", "Two", "Three"]);

      const page = await contract.getEvents(1, 1);
      expect(page.map((e) => e.name)).to.deep.equal(["Two"]);

      expect((await contract.getEvents(3, 10)).length).to.equal(0);
      expect((await contract.getEvents(50, 10)).length).to.equal(0);
    });

    it("reverts for unknown events and tickets", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.getEvent(0))
        .to.be.revertedWithCustomError(contract, "EventNotFound");
      await expect(contract.getEvent(2))
        .to.be.revertedWithCustomError(contract, "EventNotFound");
      await expect(contract.getTicket(1))
        .to.be.revertedWithCustomError(contract, "TicketNotFound");
    });
  });
});
