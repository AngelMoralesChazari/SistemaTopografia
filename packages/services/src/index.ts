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
export { listTeachers } from './userService';
export {
  registerRenter,
  watchPendingRenters,
  watchRenters,
  setRenterStatus,
} from './renterService';
export type { RegisterRenterInput } from './renterService';
export {
  createLoanRequest,
  watchLoansForStudent,
  watchLabQueue,
  watchLoansForTeacher,
  rejectLoan,
  deliverLoan,
  returnLoan,
} from './loanService';
