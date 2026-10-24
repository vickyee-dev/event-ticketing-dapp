import { formatEther } from "ethers";

export const shortAddress = (address) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

export const sameAddress = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

function trimZeros(value) {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

export function formatPrice(wei, symbol) {
  if (wei === 0n) return "Free";
  return `${trimZeros(formatEther(wei))} ${symbol}`;
}

export function formatAmount(wei, symbol) {
  return `${trimZeros(formatEther(wei))} ${symbol}`;
}

export function formatDateTime(unixSeconds) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

export function formatCountdown(seconds) {
  if (seconds <= 0) return "now";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
}

/** Value for <input type="datetime-local"> in the user's timezone. */
export function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const REVERTS = {
  EventNotFound: "That event doesn't exist.",
  TicketNotFound: "That ticket doesn't exist, or it was refunded.",
  NotOrganizer: "Only the event's organizer can do that.",
  NotTicketOwner: "This wallet doesn't own that ticket.",
  NotAuthorizedScanner: "This wallet can't check in tickets for that event.",
  InvalidParameters: "Some event details are invalid. Check the name, venue, capacity and limit.",
  StartInPast: "The start time must be in the future.",
  ZeroQuantity: "Choose at least one ticket.",
  SoldOut: "There aren't enough tickets left.",
  WalletLimitReached: "You've reached the ticket limit for this event.",
  WrongPayment: "The payment didn't match the ticket price. Refresh and try again.",
  SalesClosed: "Ticket sales for this event have closed.",
  EventIsCancelled: "This event was cancelled.",
  EventNotCancelled: "Refunds are only available for cancelled events.",
  EventNotStarted: "Proceeds unlock once the event starts.",
  EventAlreadyStarted: "The event has already started, so it can't be cancelled.",
  AlreadyCheckedIn: "This ticket has already been used.",
  InvalidRecipient: "Enter a valid wallet address that isn't your own.",
  NothingToWithdraw: "There are no proceeds to withdraw yet.",
  TransferFailed: "The payment couldn't be sent. Try again.",
  Reentrancy: "Transaction blocked. Try again.",
};

/** Turn any ethers/wallet error into one plain sentence for the user. */
export function errorMessage(error) {
  if (!error) return "Something went wrong.";
  if (
    error.code === "ACTION_REJECTED" ||
    error.code === 4001 ||
    error.info?.error?.code === 4001
  ) {
    return "You rejected the request in your wallet.";
  }
  if (error.code === "INSUFFICIENT_FUNDS") {
    return "Your wallet doesn't have enough funds for this purchase plus network fees.";
  }
  const name = error.revert?.name;
  if (name && REVERTS[name]) return REVERTS[name];
  return error.shortMessage || error.reason || error.message || "Something went wrong.";
}
