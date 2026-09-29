'use strict';
/**
 * RBAC — permissions par rôle, au format "ressource:action".
 * "ressource:*" donne toutes les actions sur la ressource, "*" donne tout.
 * La visibilité ligne à ligne (un parent ne voit que ses enfants) est gérée
 * en plus par src/services/scope.js.
 */
const COMMON = ['notifications:read', 'messages:*', 'tickets:*', 'events:read', 'announcements:read', 'lost:*', 'profile:*'];

const ROLE_PERMISSIONS = {
  admin: ['*'],
  staff: [...COMMON, 'dashboard:read', 'students:*', 'guardians:*', 'teachers:read', 'classes:*', 'levels:*', 'subjects:*', 'rooms:*',
    'timetable:*', 'attendance:*', 'grades:read', 'homework:read', 'courses:read', 'library:*', 'transport:*', 'canteen:*',
    'activities:*', 'documents:*', 'enrollments:*', 'events:*', 'announcements:*', 'finance:read', 'analytics:read', 'ai:use'],
  accountant: [...COMMON, 'dashboard:read', 'students:read', 'classes:read', 'finance:*', 'enrollments:read', 'analytics:read'],
  teacher: [...COMMON, 'dashboard:read', 'students:read', 'classes:read', 'levels:read', 'subjects:read', 'rooms:read', 'teachers:read',
    'timetable:read', 'attendance:read', 'attendance:write', 'grades:*', 'homework:*', 'courses:*', 'library:*', 'activities:read', 'ai:use'],
  nurse: [...COMMON, 'students:read', 'classes:read', 'health:*'],
  parent: [...COMMON, 'dashboard:read', 'students:read', 'classes:read', 'subjects:read', 'timetable:read', 'attendance:read', 'attendance:justify',
    'grades:read', 'homework:read', 'courses:read', 'library:read', 'transport:read', 'canteen:read', 'activities:read', 'activities:enroll',
    'finance:read', 'finance:pay', 'documents:read', 'ai:use'],
  student: [...COMMON, 'dashboard:read', 'students:read', 'classes:read', 'subjects:read', 'timetable:read', 'grades:read', 'homework:read',
    'homework:submit', 'courses:read', 'courses:progress', 'library:read', 'canteen:read', 'activities:read', 'activities:enroll', 'ai:use'],
  driver: ['notifications:read', 'profile:*', 'transport:read', 'transport:board', 'transport:position'],
};

/** Les rôles dont la visibilité sur les élèves est limitée (voir scope.js). */
const RESTRICTED_ROLES = ['teacher', 'parent', 'student', 'driver'];

function can(role, permission) {
  const perms = ROLE_PERMISSIONS[role] || [];
  const [resource] = permission.split(':');
  return perms.includes('*') || perms.includes(permission) || perms.includes(`${resource}:*`);
}

module.exports = { ROLE_PERMISSIONS, RESTRICTED_ROLES, can };
