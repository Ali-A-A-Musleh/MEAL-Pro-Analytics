import * as Icons from 'lucide-react';
import { Icon } from '@iconify/react';

const normalizeIconName = (name) => {
  const raw = String(name || '').trim();
  const directKey = raw.replace(/[^a-zA-Z0-9]/g, '');
  if (Icons[directKey]) return { type: 'lucide', name: directKey };

  const pascal = raw
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  if (Icons[pascal]) return { type: 'lucide', name: pascal };

  const lower = pascal.toLowerCase();
  const match = Object.keys(Icons).find((key) => key.toLowerCase() === lower);
  if (match) return { type: 'lucide', name: match };

  // Try Iconify with common prefixes
  const iconifyPrefixes = ['mdi:', 'fa:', 'ion:', 'lucide:', 'heroicons:', 'tabler:', 'feather:'];
  for (const prefix of iconifyPrefixes) {
    const iconifyName = prefix + raw.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    // We'll assume it's valid for now; Iconify handles invalid gracefully
    return { type: 'iconify', name: iconifyName };
  }

  // Default to Iconify with a fallback
  return { type: 'iconify', name: 'mdi:circle' };
};

const SafeIcon = ({ name, size = 16, className = '', style = {} }) => {
  const normalized = normalizeIconName(name);
  if (normalized.type === 'lucide') {
    const IconComponent = Icons[normalized.name] || Icons['Circle'];
    return <IconComponent size={size} className={className} style={style} />;
  } else if (normalized.type === 'iconify') {
    return <Icon icon={normalized.name} width={size} height={size} className={className} style={style} />;
  }
  return <Icons.Circle size={size} className={className} style={style} />;
};

export default SafeIcon;
