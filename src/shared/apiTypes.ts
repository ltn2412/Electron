export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    expiresAt: string;
  };
  message?: string;
  error?: string;
}

export interface ServiceItem {
  serviceBookingId: string;
  serviceCode: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  timeSlot?: {
    slotId: number;
    name: string;
    startTime: string;
    endTime: string;
  };
  status: string;
  usedAt: string | null;
  usedByStaffId: string | null;
}

export interface OrderStatusData {
  orderNo: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  visitDate: string;
  orderStatus: string;
  totalAmount: number;
  serviceTypeCount: number;
  createdAt: string;
  paidAt: string | null;
  usedAt: string | null;
  cancelledAt: string | null;
  services: ServiceItem[];
}

export interface OrderStatusResponse {
  success: boolean;
  data?: OrderStatusData;
  message?: string;
  error?: string;
}

export interface OrderUsePayload {
  staffId: string;
  note?: string;
}

export interface OrderUseResponse {
  success: boolean;
  message?: string;
  data?: {
    orderNo: string;
    status: string;
    usedAt: string;
    usedByStaffId: string;
  };
  error?: string;
}

export interface ExpiredOrder {
  orderNo: string;
  buyerName: string;
  buyerEmail: string;
  visitDate: string;
  expiredAt: string;
  totalServiceAmount: number;
  services: ServiceItem[];
}

export interface ExpiredOrdersData {
  items: ExpiredOrder[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ExpiredOrdersResponse {
  success: boolean;
  data?: ExpiredOrdersData;
  message?: string;
  error?: string;
}

export interface ExpiredConfirmPayload {
  orderNos: string[];
}

export interface ExpiredConfirmResponse {
  success: boolean;
  message?: string;
  data?: {
    confirmedCount: number;
  };
  error?: string;
}

export interface Slot {
  slotId: number;
  name: string;
  startTime: string;
  endTime: string;
  maxMachines: number;
  bookedMachines: number;
  availableMachines: number;
}

export interface SlotsResponse {
  success: boolean;
  data?: {
    date: string;
    slots: Slot[];
  };
  message?: string;
  error?: string;
}
