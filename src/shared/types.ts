export interface POSDETAIL {
  PRODNUM: number;
  DESCRIPT: string;
  QUAN: number;
  PRICE: number;
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
  paidAt: string;
  usedAt: string | null;
  cancelledAt: string | null;
  services: HoangVanServiceItem[];
}
