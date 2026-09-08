export interface AuditLogRecord {
  id: string;
  action: string;
  details: string;
  user: string;
  timestamp: string;
  device: string;
  browser: string;
  ipPlaceholder?: string;
  status: 'نجاح' | 'تنبيه' | 'فشل';
}

const STORAGE_KEY = 'ifc_system_audit_logs_v2';

export function getClientDeviceInfo(): { device: string; browser: string } {
  if (typeof window === 'undefined') {
    return { device: 'سيرفر', browser: 'غير محدد' };
  }

  const userAgent = navigator.userAgent;
  let os = 'جهاز غير معروف';
  let deviceType = 'كمبيوتر مكتبي / لابتوب';

  if (/android/i.test(userAgent)) {
    os = 'أندرويد (Android)';
    deviceType = 'هاتف ذكي أندرويد';
  } else if (/iPad|iPhone|iPod/.test(userAgent)) {
    os = 'نظام آبل (iOS)';
    deviceType = 'هاتف آيفون / آيباد';
  } else if (/Win/i.test(userAgent)) {
    os = 'ويندوز (Windows)';
    deviceType = 'كمبيوتر شخصي (PC)';
  } else if (/Mac/i.test(userAgent)) {
    os = 'ماك (macOS)';
    deviceType = 'جهاز ماك';
  } else if (/Linux/i.test(userAgent)) {
    os = 'لينكس (Linux)';
    deviceType = 'محطة لينكس';
  }

  let browser = 'متصفح ويب';
  if (/edg/i.test(userAgent)) {
    browser = 'مايكروسوفت إيدج (Edge)';
  } else if (/chrome|crios/i.test(userAgent) && !/edg/i.test(userAgent)) {
    browser = 'جوجل كروم (Chrome)';
  } else if (/firefox|fxios/i.test(userAgent)) {
    browser = 'موزيلا فايرفوكس (Firefox)';
  } else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) {
    browser = 'سفاري (Safari)';
  }

  const screenResolution = `${window.screen.width}x${window.screen.height}`;
  return {
    device: `${deviceType} - [${os}] (${screenResolution})`,
    browser,
  };
}

export function logAuditEvent(
  action: string,
  details: string,
  userName = 'المسؤول الحالي',
  status: 'نجاح' | 'تنبيه' | 'فشل' = 'نجاح'
): AuditLogRecord {
  const { device, browser } = getClientDeviceInfo();
  const now = new Date();
  
  // Format Arabic friendly readable date & time
  const formattedTime = now.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const record: AuditLogRecord = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    action,
    details,
    user: userName,
    timestamp: formattedTime,
    device,
    browser,
    status,
  };

  try {
    const existing = getAuditLogs();
    const updated = [record, ...existing].slice(0, 200); // keep last 200 operations
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save audit log:', err);
  }

  return record;
}

export function logAudit(params: {
  userId?: string;
  userName?: string;
  action: string;
  category?: string;
  details?: string;
  status?: 'نجاح' | 'تنبيه' | 'فشل';
}): AuditLogRecord {
  const fullDetails = params.category
    ? `[${params.category}] ${params.details || ''}`
    : params.details || '';
  return logAuditEvent(params.action, fullDetails, params.userName || 'المسؤول الحالي', params.status || 'نجاح');
}

export function getAuditLogs(): AuditLogRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to read audit logs:', e);
  }

  // No demo/seed audit records. A new installation starts with an empty log.
  return [];
}
