import type { OrderStatus } from "../api";

export const ORDER_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "REJECTED"];

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "CONFIRMED":
      return "Confirmed";
    case "REJECTED":
      return "Rejected";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}
