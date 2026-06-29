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
