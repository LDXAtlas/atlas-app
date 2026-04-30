import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const getIconByName = (name: string | null | undefined): LucideIcon => {
  if (!name) return LucideIcons.Building;
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon>)[name];
  return Icon || LucideIcons.Building;
};

export const MINISTRY_ICON_NAMES = [
  'Music', 'Mic', 'Headphones', 'Speaker', 'Radio',
  'Users', 'User', 'UserPlus', 'Heart', 'HeartHandshake', 'HandHeart',
  'Baby', 'Smile', 'BookOpen', 'GraduationCap', 'School', 'Pencil',
  'Settings', 'Briefcase', 'Building', 'Building2', 'Wrench', 'ClipboardList', 'FileText', 'Folder',
  'Globe', 'Globe2', 'MapPin', 'Map', 'Compass', 'Plane', 'Truck', 'Mountain',
  'HeartPulse', 'Activity', 'Cross', 'Sparkles',
  'Coffee', 'UtensilsCrossed', 'Cake', 'Gift', 'Calendar', 'CalendarDays', 'Clock',
  'Camera', 'Video', 'Monitor', 'Laptop', 'Smartphone',
  'Church', 'BookMarked', 'Library', 'Lightbulb', 'Star', 'Sun', 'Moon', 'Flame',
];
