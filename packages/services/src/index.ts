export {
  getFirebaseApp,
  getFirebaseAuth,
  getDb,
  getFirebaseStorage,
  checkFirebaseReady,
} from './firebase';
export { signIn, signOut, resetPassword, watchAuth, refreshCurrentUser } from './authService';
export {
  listEquipment,
  watchEquipment,
  createEquipment,
  updateEquipment,
  setEquipmentStatus,
} from './equipmentService';
export { listTeachers, watchLabUsers } from './userService';
export {
  registerRenter,
  watchPendingRenters,
  watchRenters,
  setRenterStatus,
} from './renterService';
export type { RegisterRenterInput } from './renterService';
export { writeAuditLog, watchAuditLogs } from './auditService';
export type { AuditLogEntry, WriteAuditInput } from './auditService';
export {
  createLoanRequest,
  watchLoansForStudent,
  watchLabQueue,
  watchLabLoans,
  watchLoansForTeacher,
  rejectLoan,
  deliverLoan,
  returnLoan,
  adminOverrideLoanStatus,
} from './loanService';
export type { AdminActor } from './loanService';
