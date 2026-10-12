export const BILL_CATEGORIES = [
  { id: 'electricity', label: 'Electricity', icon: '⚡', color: '#f59e0b' },
  { id: 'gas', label: 'Gas', icon: '🔥', color: '#ef4444' },
  { id: 'water', label: 'Water', icon: '💧', color: '#3b82f6' },
  { id: 'internet', label: 'Internet', icon: '🌐', color: '#8b5cf6' },
  { id: 'phone', label: 'Phone/Mobile', icon: '📱', color: '#06b6d4' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', color: '#10b981' },
  { id: 'rent', label: 'Rent/Mortgage', icon: '🏠', color: '#6366f1' },
  { id: 'subscription', label: 'Subscription', icon: '📺', color: '#ec4899' },
  { id: 'transport', label: 'Transport', icon: '🚗', color: '#14b8a6' },
  { id: 'health', label: 'Health', icon: '🏥', color: '#f43f5e' },
  { id: 'finance', label: 'Finance/Loans', icon: '🏦', color: '#0ea5e9' },
  { id: 'afterpay', label: 'Afterpay', icon: '💳', color: '#a855f7' },
  { id: 'other', label: 'Other', icon: '📋', color: '#6b7280' },
];

export function getCategoryById(id) {
  return BILL_CATEGORIES.find(c => c.id === id) || BILL_CATEGORIES[BILL_CATEGORIES.length - 1];
}

/**
 * Auto-detect category from bill description.
 */
export function detectCategory(description) {
  const desc = (description || '').toLowerCase();

  if (/electric|power|powershop|energy|agl|origin/.test(desc)) return 'electricity';
  if (/\bgas\b/.test(desc)) return 'gas';
  if (/water/.test(desc)) return 'water';
  if (/internet|broadband|nbn|superloop|spintel|tpg|iinet|aussie/.test(desc)) return 'internet';
  if (/phone|mobile|optus|telstra|vodafone|amaysim/.test(desc)) return 'phone';
  if (/insurance|budget direct|allianz|nrma|rac/.test(desc)) return 'insurance';
  if (/rent|mortgage|strata|real estate/.test(desc)) return 'rent';
  if (/netflix|spotify|disney|youtube|subscription/.test(desc)) return 'subscription';
  if (/rego|car|transport|toll|fuel/.test(desc)) return 'transport';
  if (/health|medical|dental|physio|doctor/.test(desc)) return 'health';
  if (/loan|credit|bank|finance/.test(desc)) return 'finance';
  if (/afterpay|zip|humm|latitude/.test(desc)) return 'afterpay';

  return 'other';
}
