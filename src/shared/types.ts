export interface POSDETAIL {
  PRODNUM: number;
  DESCRIPT: string;
  QUAN: number;
  COSTEACH: number;
  REFCODE?: string;
  [key: string]: unknown;
}

export interface POSHEADER {
  TRANSACT: number;
  TIMEEND: string;
  FINALTOTAL: number;
  EMPNAME: string;
  POSAudioStatus: number;
  POSAudioStatusName: string;
  POSDETAILS?: POSDETAIL[];
  [key: string]: unknown;
}

export interface ProductPOSAudio {
  PRODNUM: number;
  DESCRIPT: string;
  REFCODE: string;
  STORAGE: number;
  QUANTITY: number;
  ISPRIMARY?: number;
  PRODNUMLINK?: number;
  COUNT?: number;
  OUT?: number;
  [key: string]: unknown;
}

export interface TransactionDetailPOSAudio {
  PRODNUM: number;
  QuantityOut: number;
  QuantityReturn: number;
}

export interface TransactionPOSAudioPayload {
  Transact: number;
  Status: number;
  PhoneNumber: string | null;
  TransactionDetailPOSAudios: {
    PRODNUM: number;
    QuantityOut: number;
    QuantityReturn: number;
  }[];
}

export interface HoangVanSlot {
  slotId: number;
  name: string;
  startTime: string;
  endTime: string;
  maxMachines: number;
  bookedMachines: number;
  availableMachines: number;
}

export interface HoangVanServiceItem {
  serviceBookingId: string;
  serviceCode: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  timeSlot: {
    slotId: number;
    name: string;
    startTime: string;
    endTime: string;
  };
  status: string;
  usedAt: string | null;
  usedByStaffId: string | null;
}

export interface HoangVanOrder {
  orderNo: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  visitDate: string;
  orderStatus: "ChuaSuDung" | "DaSuDung" | "HetHan" | "DaHuy" | string;
  totalAmount: number;
  serviceTypeCount: number;
  createdAt: string;
  paidAt: string | null;
  usedAt: string | null;
  cancelledAt: string | null;
  services: HoangVanServiceItem[];
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    expiresAt: string;
  };
  message?: string;
  error?: string;
}

export interface OrderStatusResponse {
  success: boolean;
  data?: HoangVanOrder;
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
  buyerPhone?: string;
  visitDate: string;
  expiredAt: string;
  totalServiceAmount: number;
  services: HoangVanServiceItem[];
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

export interface SlotsResponse {
  success: boolean;
  data?: {
    date: string;
    slots: HoangVanSlot[];
  };
  message?: string;
  error?: string;
}
