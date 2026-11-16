import React from 'react';
import {
  Box,
  Briefcase,
  Camera,
  Film,
  Gamepad2,
  LayoutGrid,
  Palette,
  PartyPopper,
  Shapes,
  Tag,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Box,
  Boxes: Box,
  Film,
  Clapperboard: Film,
  Gamepad2,
  Tag,
  Camera,
  Palette,
  Shapes,
  Briefcase,
  PartyPopper,
  CalendarHeart: PartyPopper,
  Printer: Tag,
  Megaphone: Briefcase,
  Hexagon: Shapes,
};

export const CategoryIcon: React.FC<{ name?: string; className?: string }> = ({
  name,
  className = 'w-4 h-4',
}) => {
  const Icon = (name && ICONS[name]) || LayoutGrid;
  return <Icon className={className} />;
};
