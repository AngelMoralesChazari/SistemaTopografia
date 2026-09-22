export {
  getFirebaseApp,
  getFirebaseAuth,
  getDb,
  getFirebaseStorage,
  checkFirebaseReady,
} from './firebase';
export {
  signIn,
  signInWithGoogle,
  signOut,
  resetPassword,
  watchAuth,
  refreshCurrentUser,
  isUagroEmail,
  extractStudentIdFromEmail,
  EXCEPTION_STAFF_EMAILS,
} from './authService';
export {
  listEquipment,
  watchEquipment,
  createEquipment,
  updateEquipment,
  setEquipmentStatus,
} from './equipmentService';
export {
  uploadEquipmentPhoto,
  deleteEquipmentPhotoByUrl,
} from './storageService';
export {
  listTeachers,
  watchLabUsers,
  createTeacher,
  updateTeacher,
  setTeacherActiveStatus,
  assignStudentAcademicGroup,
  syncPendingStudentsForTeacher,
} from './userService';
export type {
  CreateTeacherInput,
  UpdateTeacherInput,
  AssignStudentGroupResult,
} from './userService';
export { listGroups, ensureDefaultGroups, watchGroups } from './groupService';
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
