'use strict';
/**
 * Modèles Sequelize — miroir de database/schema.sql (source de vérité).
 * Aucun `sync()` : le schéma est géré en SQL (npm run db:init).
 */
const { DataTypes: T } = require('sequelize');
const sequelize = require('../config/database');
const { applyTenantScope } = require('./tenantScope');

const ID = { type: T.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true };
const FK = (allowNull = false) => ({ type: T.BIGINT.UNSIGNED, allowNull });
const json = name => ({
  type: T.TEXT('long'),
  get() { const v = this.getDataValue(name); if (v == null) return null; try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; } },
  set(v) { this.setDataValue(name, v == null ? null : JSON.stringify(v)); },
});
const bool = (def = false) => ({ type: T.BOOLEAN, allowNull: false, defaultValue: def });

/** Déclare un modèle scopé au tenant. */
function tenantModel(name, table, attrs, opts = {}) {
  const M = sequelize.define(name, { id: ID, tenantId: FK(), ...attrs }, { tableName: table, ...opts });
  applyTenantScope(M);
  return M;
}

// ---------- Plateforme (non scopés) ----------
const Plan = sequelize.define('Plan', {
  id: { type: T.STRING(20), primaryKey: true }, name: T.STRING, priceCents: T.INTEGER, maxStudents: T.INTEGER, features: json('features'),
}, { tableName: 'plans', timestamps: false });

const Tenant = sequelize.define('Tenant', {
  id: ID, slug: T.STRING, name: T.STRING, city: T.STRING, planId: T.STRING(20), customDomain: T.STRING, currency: T.STRING(3),
  primaryColor: T.STRING(9), logoUrl: T.STRING, schoolYear: T.STRING(9), settings: json('settings'), status: T.STRING,
}, { tableName: 'tenants' });

// ---------- Identité ----------
const User = tenantModel('User', 'users', {
  role: { type: T.STRING, allowNull: false }, email: { type: T.STRING, allowNull: false }, passwordHash: T.STRING,
  firstName: T.STRING, lastName: T.STRING, phone: T.STRING, locale: { type: T.STRING(5), defaultValue: 'fr' }, notifyPrefs: json('notifyPrefs'),
  totpSecret: T.STRING, totpEnabled: bool(),
  status: { type: T.STRING, defaultValue: 'active' }, failedLogins: { type: T.INTEGER, defaultValue: 0 },
  lockedUntil: T.DATE, lastLoginAt: T.DATE,
}, { defaultScope: { attributes: { exclude: ['passwordHash', 'totpSecret'] } }, scopes: { withSecrets: { attributes: { include: ['passwordHash', 'totpSecret'] } } } });

const Session = tenantModel('Session', 'sessions', {
  userId: FK(), refreshHash: T.STRING(64), userAgent: T.STRING, ip: T.STRING, expiresAt: T.DATE, revokedAt: T.DATE,
});
const AuditLog = tenantModel('AuditLog', 'audit_logs', {
  userId: FK(true), action: T.STRING, entity: T.STRING, entityId: T.STRING, method: T.STRING, path: T.STRING,
  statusCode: T.SMALLINT, ip: T.STRING, meta: json('meta'),
}, { updatedAt: false });
const Notification = tenantModel('Notification', 'notifications', {
  userId: FK(), kind: T.STRING, title: T.STRING, body: T.STRING, link: T.STRING, readAt: T.DATE,
});

// ---------- Structure ----------
const Level = tenantModel('Level', 'levels', { name: T.STRING, cycle: T.STRING, position: T.INTEGER });
const Subject = tenantModel('Subject', 'subjects', { name: T.STRING, shortName: T.STRING, coefficient: T.DECIMAL(4, 2), color: T.STRING });
const Room = tenantModel('Room', 'rooms', { name: T.STRING, capacity: T.INTEGER });
const Teacher = tenantModel('Teacher', 'teachers', { userId: FK(), subjectId: FK(true), hiredOn: T.DATEONLY, status: { type: T.STRING, defaultValue: 'active' } });
const Class = tenantModel('Class', 'classes', {
  levelId: FK(), name: T.STRING, schoolYear: T.STRING(9), capacity: T.INTEGER, roomId: FK(true), mainTeacherId: FK(true),
});
const ClassSubject = tenantModel('ClassSubject', 'class_subjects', { classId: FK(), subjectId: FK(), teacherId: FK(true), weeklyHours: T.TINYINT });

// ---------- Élèves & familles ----------
const Student = tenantModel('Student', 'students', {
  userId: FK(true), classId: FK(true), matricule: T.STRING, firstName: T.STRING, lastName: T.STRING, gender: T.STRING(1),
  birthDate: T.DATEONLY, address: T.STRING, photoUrl: T.STRING, status: { type: T.STRING, defaultValue: 'enrolled' },
  enrolledOn: T.DATEONLY, usesCanteen: bool(),
});
const Guardian = tenantModel('Guardian', 'guardians', {
  userId: FK(true), firstName: T.STRING, lastName: T.STRING, relation: T.STRING, phone: T.STRING, email: T.STRING, job: T.STRING,
});
const StudentGuardian = tenantModel('StudentGuardian', 'student_guardians', { studentId: FK(), guardianId: FK(), isEmergency: bool() });

// ---------- Emploi du temps ----------
const TimetableSlot = tenantModel('TimetableSlot', 'timetable_slots', {
  classId: FK(), subjectId: FK(), teacherId: FK(), roomId: FK(true), weekday: T.TINYINT, startTime: T.TIME, endTime: T.TIME,
});
const TimetableException = tenantModel('TimetableException', 'timetable_exceptions', {
  slotId: FK(), onDate: T.DATEONLY, kind: T.STRING, substituteTeacherId: FK(true), roomId: FK(true), note: T.STRING,
});

// ---------- Présences, notes, devoirs ----------
const Attendance = tenantModel('Attendance', 'attendance', {
  studentId: FK(), onDate: T.DATEONLY, period: { type: T.STRING, defaultValue: 'day' }, status: T.STRING, minutesLate: T.SMALLINT,
  justified: bool(), reason: T.STRING, proofUrl: T.STRING, recordedBy: FK(true),
});
const Evaluation = tenantModel('Evaluation', 'evaluations', {
  classId: FK(), subjectId: FK(), teacherId: FK(true), kind: T.STRING, title: T.STRING, coefficient: T.DECIMAL(4, 2),
  maxScore: T.DECIMAL(5, 2), heldOn: T.DATEONLY, term: T.TINYINT, published: bool(),
});
const Grade = tenantModel('Grade', 'grades', { evaluationId: FK(), studentId: FK(), score: T.DECIMAL(5, 2), comment: T.STRING });
const Homework = tenantModel('Homework', 'homework', {
  classId: FK(), subjectId: FK(), teacherId: FK(true), title: T.STRING, instructions: T.TEXT, dueAt: T.DATE, attachments: json('attachments'),
});
const HomeworkSubmission = tenantModel('HomeworkSubmission', 'homework_submissions', {
  homeworkId: FK(), studentId: FK(), status: { type: T.STRING, defaultValue: 'todo' }, submittedAt: T.DATE, fileUrl: T.STRING,
  score: T.DECIMAL(5, 2), feedback: T.STRING,
});

// ---------- E-learning & bibliothèque ----------
const Course = tenantModel('Course', 'courses', {
  subjectId: FK(), levelId: FK(true), teacherId: FK(true), title: T.STRING, description: T.TEXT, status: { type: T.STRING, defaultValue: 'draft' },
});
const CourseLesson = tenantModel('CourseLesson', 'course_lessons', {
  courseId: FK(), chapter: T.STRING, position: T.INTEGER, title: T.STRING, kind: T.STRING, contentUrl: T.STRING, fileId: FK(true), quiz: json('quiz'),
});
const LessonProgress = tenantModel('LessonProgress', 'lesson_progress', { lessonId: FK(), studentId: FK(), completedAt: T.DATE, score: T.DECIMAL(5, 2) });
const LibraryItem = tenantModel('LibraryItem', 'library_items', {
  title: T.STRING, author: T.STRING, kind: T.STRING, subjectId: FK(true), level: T.STRING, fileUrl: T.STRING, downloads: { type: T.INTEGER, defaultValue: 0 },
});

// ---------- Transport ----------
const Bus = tenantModel('Bus', 'buses', {
  lineName: T.STRING, plate: T.STRING, model: T.STRING, capacity: T.INTEGER, color: T.STRING, driverUserId: FK(true),
  attendantUserId: FK(true), gpsDeviceId: T.STRING, status: { type: T.STRING, defaultValue: 'parked' }, delayMinutes: { type: T.SMALLINT, defaultValue: 0 },
});
const BusStop = tenantModel('BusStop', 'bus_stops', {
  busId: FK(), position: T.INTEGER, name: T.STRING, lat: T.DECIMAL(9, 6), lng: T.DECIMAL(9, 6), scheduledTime: T.TIME,
});
const BusAssignment = tenantModel('BusAssignment', 'bus_assignments', { studentId: FK(), busId: FK(), stopId: FK() });
const BusPosition = tenantModel('BusPosition', 'bus_positions', {
  busId: FK(), lat: T.DECIMAL(9, 6), lng: T.DECIMAL(9, 6), speed: T.DECIMAL(5, 1), recordedAt: T.DATE,
}, { timestamps: false });
const BusBoarding = tenantModel('BusBoarding', 'bus_boardings', {
  studentId: FK(), busId: FK(), event: T.STRING, method: T.STRING, recordedAt: { type: T.DATE, defaultValue: T.NOW },
}, { timestamps: false });

// ---------- Vie scolaire ----------
const CanteenMenu = tenantModel('CanteenMenu', 'canteen_menus', {
  onDate: T.DATEONLY, starter: T.STRING, main: T.STRING, side: T.STRING, dessert: T.STRING, vegetarian: T.STRING,
});
const Activity = tenantModel('Activity', 'activities', {
  name: T.STRING, kind: T.STRING, capacity: T.INTEGER, priceCents: { type: T.INTEGER, defaultValue: 0 }, startsAt: T.DATE,
  schedule: T.STRING, place: T.STRING, teacherId: FK(true),
});
const ActivityEnrollment = tenantModel('ActivityEnrollment', 'activity_enrollments', { activityId: FK(), studentId: FK(), consentAt: T.DATE });
const HealthRecord = tenantModel('HealthRecord', 'health_records', {
  studentId: FK(), bloodType: T.STRING, allergiesEnc: T.TEXT, notesEnc: T.TEXT, diet: T.STRING,
});
const InfirmaryVisit = tenantModel('InfirmaryVisit', 'infirmary_visits', {
  studentId: FK(), visitedAt: T.DATE, kind: { type: T.STRING, defaultValue: 'visit' }, reasonEnc: T.TEXT, careEnc: T.TEXT,
  parentsNotified: bool(), nurseUserId: FK(true),
});
const LostItem = tenantModel('LostItem', 'lost_items', {
  kind: T.STRING, category: T.STRING, description: T.STRING, place: T.STRING, onDate: T.DATEONLY, photoUrl: T.STRING,
  status: { type: T.STRING, defaultValue: 'open' }, reportedBy: FK(true),
});
const Document = tenantModel('Document', 'documents', {
  studentId: FK(true), kind: T.STRING, title: T.STRING, fileUrl: T.STRING, sha256: T.STRING(64), signedAt: T.DATE, createdBy: FK(true),
});
const EnrollmentApplication = tenantModel('EnrollmentApplication', 'enrollment_applications', {
  studentFirstName: T.STRING, studentLastName: T.STRING, birthDate: T.DATEONLY, levelId: FK(true), guardianName: T.STRING,
  guardianPhone: T.STRING, guardianEmail: T.STRING, status: { type: T.STRING, defaultValue: 'new' }, docs: json('docs'),
  paid: bool(), source: T.STRING,
});

// ---------- Finance ----------
const Invoice = tenantModel('Invoice', 'invoices', {
  number: T.STRING, studentId: FK(), label: T.STRING, kind: T.STRING, dueOn: T.DATEONLY, amountCents: T.INTEGER,
  status: { type: T.STRING, defaultValue: 'due' }, paidAt: T.DATE,
});
const Payment = tenantModel('Payment', 'payments', {
  invoiceId: FK(), amountCents: T.INTEGER, method: T.STRING, providerRef: T.STRING, paidAt: T.DATE, recordedBy: FK(true),
});

// ---------- Communication & support ----------
const Conversation = tenantModel('Conversation', 'conversations', { title: T.STRING, kind: { type: T.STRING, defaultValue: 'direct' } });
const ConversationMember = tenantModel('ConversationMember', 'conversation_members', { conversationId: FK(), userId: FK(), lastReadAt: T.DATE });
const Message = tenantModel('Message', 'messages', { conversationId: FK(), senderId: FK(), body: T.TEXT });
const Announcement = tenantModel('Announcement', 'announcements', {
  title: T.STRING, body: T.TEXT, audience: { type: T.STRING, defaultValue: 'all' }, channels: json('channels'), pinned: bool(),
  publishedAt: T.DATE, authorId: FK(true),
});
const Event = tenantModel('Event', 'events', { title: T.STRING, kind: T.STRING, startsAt: T.DATE, endsAt: T.DATE, audience: { type: T.STRING, defaultValue: 'all' } });
const Ticket = tenantModel('Ticket', 'tickets', {
  number: T.STRING, authorId: FK(), category: T.STRING, priority: { type: T.STRING, defaultValue: 'normal' },
  status: { type: T.STRING, defaultValue: 'new' }, subject: T.STRING,
});
const TicketMessage = tenantModel('TicketMessage', 'ticket_messages', { ticketId: FK(), authorId: FK(), body: T.TEXT });

// ---------- Fichiers, envois, push, paiements (migration 001) ----------
const File = tenantModel('File', 'files', {
  ownerUserId: FK(true), kind: T.STRING, originalName: T.STRING, mime: T.STRING, sizeBytes: T.INTEGER, storageKey: T.STRING, sha256: T.STRING(64),
});
const NotificationDelivery = tenantModel('NotificationDelivery', 'notification_deliveries', {
  notificationId: FK(true), userId: FK(), channel: T.STRING, status: T.STRING, provider: T.STRING, destination: T.STRING, error: T.STRING,
}, { updatedAt: false });
const PushSubscription = tenantModel('PushSubscription', 'push_subscriptions', {
  userId: FK(), endpoint: T.STRING(700), endpointHash: T.STRING(64), p256dh: T.STRING, auth: T.STRING, userAgent: T.STRING,
});
const PaymentSession = tenantModel('PaymentSession', 'payment_sessions', {
  invoiceId: FK(), createdBy: FK(true), provider: T.STRING, providerSessionId: T.STRING, status: { type: T.STRING, defaultValue: 'pending' },
  amountCents: T.INTEGER, checkoutUrl: T.STRING(1000),
});

// =====================================================================
// Associations
// =====================================================================
Tenant.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });

Teacher.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Teacher.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
User.hasOne(Teacher, { foreignKey: 'userId', as: 'teacher' });

Class.belongsTo(Level, { foreignKey: 'levelId', as: 'level' });
Class.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });
Class.belongsTo(Teacher, { foreignKey: 'mainTeacherId', as: 'mainTeacher' });
Class.hasMany(Student, { foreignKey: 'classId', as: 'students' });
Class.hasMany(ClassSubject, { foreignKey: 'classId', as: 'classSubjects' });
ClassSubject.belongsTo(Class, { foreignKey: 'classId', as: 'class' });
ClassSubject.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
ClassSubject.belongsTo(Teacher, { foreignKey: 'teacherId', as: 'teacher' });

Student.belongsTo(Class, { foreignKey: 'classId', as: 'class' });
Student.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Student.hasMany(StudentGuardian, { foreignKey: 'studentId', as: 'guardianLinks' });
Guardian.hasMany(StudentGuardian, { foreignKey: 'guardianId', as: 'childLinks' });
Guardian.belongsTo(User, { foreignKey: 'userId', as: 'user' });
StudentGuardian.belongsTo(Guardian, { foreignKey: 'guardianId', as: 'guardian' });
StudentGuardian.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

TimetableSlot.belongsTo(Class, { foreignKey: 'classId', as: 'class' });
TimetableSlot.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
TimetableSlot.belongsTo(Teacher, { foreignKey: 'teacherId', as: 'teacher' });
TimetableSlot.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });
TimetableSlot.hasMany(TimetableException, { foreignKey: 'slotId', as: 'exceptions' });

Attendance.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Evaluation.belongsTo(Class, { foreignKey: 'classId', as: 'class' });
Evaluation.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
Evaluation.hasMany(Grade, { foreignKey: 'evaluationId', as: 'grades' });
Grade.belongsTo(Evaluation, { foreignKey: 'evaluationId', as: 'evaluation' });
Grade.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

Homework.belongsTo(Class, { foreignKey: 'classId', as: 'class' });
Homework.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
Homework.belongsTo(Teacher, { foreignKey: 'teacherId', as: 'teacher' });
Homework.hasMany(HomeworkSubmission, { foreignKey: 'homeworkId', as: 'submissions' });
HomeworkSubmission.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

Course.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
Course.belongsTo(Level, { foreignKey: 'levelId', as: 'level' });
Course.belongsTo(Teacher, { foreignKey: 'teacherId', as: 'teacher' });
Course.hasMany(CourseLesson, { foreignKey: 'courseId', as: 'lessons' });
LessonProgress.belongsTo(CourseLesson, { foreignKey: 'lessonId', as: 'lesson' });
LibraryItem.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });

Bus.hasMany(BusStop, { foreignKey: 'busId', as: 'stops' });
Bus.hasMany(BusAssignment, { foreignKey: 'busId', as: 'assignments' });
Bus.belongsTo(User, { foreignKey: 'driverUserId', as: 'driver' });
Bus.belongsTo(User, { foreignKey: 'attendantUserId', as: 'attendant' });
BusAssignment.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
BusAssignment.belongsTo(Bus, { foreignKey: 'busId', as: 'bus' });
BusAssignment.belongsTo(BusStop, { foreignKey: 'stopId', as: 'stop' });
Student.hasOne(BusAssignment, { foreignKey: 'studentId', as: 'busAssignment' });
BusBoarding.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

Activity.belongsTo(Teacher, { foreignKey: 'teacherId', as: 'teacher' });
Activity.hasMany(ActivityEnrollment, { foreignKey: 'activityId', as: 'enrollments' });
ActivityEnrollment.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
ActivityEnrollment.belongsTo(Activity, { foreignKey: 'activityId', as: 'activity' });
HealthRecord.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
InfirmaryVisit.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Document.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
EnrollmentApplication.belongsTo(Level, { foreignKey: 'levelId', as: 'level' });

Invoice.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Invoice.hasMany(Payment, { foreignKey: 'invoiceId', as: 'payments' });
Payment.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });

Conversation.hasMany(ConversationMember, { foreignKey: 'conversationId', as: 'members' });
Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages' });
ConversationMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ConversationMember.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'conversation' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Ticket.belongsTo(User, { foreignKey: 'authorId', as: 'author' });
Ticket.hasMany(TicketMessage, { foreignKey: 'ticketId', as: 'messages' });
TicketMessage.belongsTo(User, { foreignKey: 'authorId', as: 'author' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
PaymentSession.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
NotificationDelivery.belongsTo(User, { foreignKey: 'userId', as: 'user' });
CourseLesson.belongsTo(File, { foreignKey: 'fileId', as: 'file' });

module.exports = {
  sequelize, Plan, Tenant, User, Session, AuditLog, Notification,
  Level, Subject, Room, Teacher, Class, ClassSubject,
  Student, Guardian, StudentGuardian, TimetableSlot, TimetableException,
  Attendance, Evaluation, Grade, Homework, HomeworkSubmission,
  Course, CourseLesson, LessonProgress, LibraryItem,
  Bus, BusStop, BusAssignment, BusPosition, BusBoarding,
  CanteenMenu, Activity, ActivityEnrollment, HealthRecord, InfirmaryVisit, LostItem, Document, EnrollmentApplication,
  Invoice, Payment, File, NotificationDelivery, PushSubscription, PaymentSession, Conversation, ConversationMember, Message, Announcement, Event, Ticket, TicketMessage,
};
