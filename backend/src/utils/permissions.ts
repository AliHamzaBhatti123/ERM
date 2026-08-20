export function canManageInventory(role: 'ADMIN' | 'MANAGER' | 'STAFF') { return role === 'ADMIN' || role === 'MANAGER'; }
export function canDeactivateProduct(role: 'ADMIN' | 'MANAGER' | 'STAFF') { return role === 'ADMIN'; }
export function canCreateCategory(role: 'ADMIN' | 'MANAGER' | 'STAFF') { return role === 'ADMIN' || role === 'MANAGER'; }
