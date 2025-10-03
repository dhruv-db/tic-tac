// Data validation utilities for handling Bexio API responses safely

/**
 * Safely converts a value to string, handling undefined/null cases
 */
export function safeToString(value: any, fallback: string = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
  return String(value);
}

/**
 * Safely converts a number to string, with validation
 */
export function safeNumberToString(value: number | null | undefined, fallback: string = ''): string {
  if (value == null || isNaN(value)) return fallback;
  return value.toString();
}

/**
 * Validates if an object has required properties and they are not null/undefined
 */
export function hasValidProperties(obj: any, requiredProps: string[]): boolean {
  if (!obj || typeof obj !== 'object') return false;

  return requiredProps.every(prop => {
    const value = obj[prop];
    return value != null && value !== '';
  });
}

/**
 * Safely accesses nested object properties
 */
export function safeGet(obj: any, path: string, fallback: any = undefined): any {
  if (!obj || typeof obj !== 'object') return fallback;

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current == null || typeof current !== 'object') return fallback;
    current = current[key];
  }

  return current != null ? current : fallback;
}

/**
 * Validates and filters an array of objects, ensuring each has required properties
 */
export function filterValidObjects<T extends Record<string, any>>(
  array: any[],
  requiredProps: (keyof T)[],
  additionalValidation?: (item: any) => boolean
): T[] {
  if (!Array.isArray(array)) return [];

  return array.filter(item => {
    if (!item || typeof item !== 'object') return false;

    // Check required properties
    const hasRequired = requiredProps.every(prop => {
      const value = item[prop];
      return value != null && value !== '';
    });

    // Additional validation if provided
    const passesAdditional = additionalValidation ? additionalValidation(item) : true;

    return hasRequired && passesAdditional;
  }) as T[];
}

/**
 * Safely formats duration from various input types
 */
export function safeFormatDuration(seconds: number | string | null | undefined): string {
  if (seconds == null) return '0h 0m';

  let numSeconds: number;
  if (typeof seconds === 'string') {
    numSeconds = parseFloat(seconds) || 0;
  } else if (typeof seconds === 'number') {
    numSeconds = seconds;
  } else {
    return '0h 0m';
  }

  if (isNaN(numSeconds) || numSeconds < 0) return '0h 0m';

  const hours = Math.floor(numSeconds / 3600);
  const minutes = Math.floor((numSeconds % 3600) / 60);

  return `${hours}h ${minutes}m`;
}

/**
 * Safely parses duration string to seconds
 */
export function safeParseDuration(duration: string | number | null | undefined): number {
  if (duration == null) return 0;

  if (typeof duration === 'number') return duration;

  if (typeof duration === 'string') {
    // Handle formats like "HH:MM" or "H:MM"
    if (duration.includes(':')) {
      const [h, m] = duration.split(':').map((v) => parseInt(v.trim(), 10));
      const hours = isNaN(h) ? 0 : h;
      const minutes = isNaN(m) ? 0 : m;
      return hours * 3600 + minutes * 60;
    }
    // Fallback: numeric string representing seconds
    const parsed = Number(duration);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

/**
 * Validates project object - only requires ID, name is optional
 */
export function isValidProject(project: any): project is { id: number; name?: string } {
  return project &&
         typeof project === 'object' &&
         typeof project.id === 'number' &&
         !isNaN(project.id);
}

/**
 * Validates contact object - only requires ID, name_1 is optional
 */
export function isValidContact(contact: any): contact is { id: number; name_1?: string } {
  return contact &&
         typeof contact === 'object' &&
         typeof contact.id === 'number' &&
         !isNaN(contact.id);
}

/**
 * Validates time entry object - only requires ID and date, others are optional
 */
export function isValidTimeEntry(entry: any): entry is {
  id: number;
  date: string;
  duration?: string | number;
  text?: string;
  allowable_bill?: boolean;
} {
  return entry &&
         typeof entry === 'object' &&
         typeof entry.id === 'number' &&
         !isNaN(entry.id) &&
         typeof entry.date === 'string' &&
         entry.date.trim() !== '';
}

/**
 * Safely gets project name with fallback
 */
export function safeGetProjectName(project: any, fallback: string = 'Unknown Project'): string {
  if (!project) return fallback;
  return typeof project.name === 'string' ? project.name : fallback;
}

/**
 * Safely gets contact name with fallback
 */
export function safeGetContactName(contact: any, fallback: string = 'Unknown Contact'): string {
  if (!contact) return fallback;
  return typeof contact.name_1 === 'string' ? contact.name_1 : fallback;
}

/**
 * Safely gets time entry text with fallback
 */
export function safeGetTimeEntryText(entry: any, fallback: string = 'Time Entry'): string {
  if (!entry) return fallback;
  return typeof entry.text === 'string' && entry.text.trim() !== '' ? entry.text : fallback;
}

/**
 * Creates a safe select option from an object with id and name
 */
export function createSafeSelectOption(item: any, fallbackLabel: string = 'Unknown') {
  if (!item) return null;

  const id = safeNumberToString(item.id, '');
  const label = safeToString(item.name || item.name_1 || item.text, fallbackLabel);

  if (!id) return null;

  return {
    value: id,
    label: label,
    key: id
  };
}