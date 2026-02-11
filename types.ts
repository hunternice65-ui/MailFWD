
export interface FormData {
  projectName: string;
  eventDate: string;
  location: string;
  organizer: string;
  fullName: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  attendanceType: 'Onsite' | 'Rerun' | '';
  feeAcknowledged: boolean;
  feePaid: boolean;
  paymentSlip: string; // Base64 image data
  signatureData: string;
  isCertified: boolean;
  submissionDate: string;
}

export enum AttendanceType {
  ONSITE = 'Onsite',
  RERUN = 'Rerun'
}
