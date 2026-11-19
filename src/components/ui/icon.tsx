/**
 * FEATURE: Icons
 * WHAT: Maps the prototype's short icon names ("hammer", "flame", "cal") to
 *       Lucide icons (https://lucide.dev, ISC licence). Stroke 2, sized by the
 *       prototype's .icon / .i14 / .i16 classes.
 */
import {
  ArrowLeft, ArrowRight, ArrowUpDown, BedDouble, Bell, Bike, BookOpen, Bookmark, Calendar, Camera, Check, ChevronDown,
  ChevronRight, ChevronUp, CircleAlert, CircleHelp, Clock, Compass, Drama, Dumbbell, Ellipsis, Eye, Filter, Flag, Flame,
  Gavel, Gift, GraduationCap, GripVertical, Heart, Hourglass, House, Image as ImageIcon, IndianRupee, Info, KeyRound, Laptop,
  LayoutGrid, Layers, List, LoaderCircle, Lock, LogOut, Mail, MapPin, Maximize2, Menu, MessageCircle, Minus, Moon, Music,
  Package, PackagePlus, PartyPopper, Pause, Pencil, Play, Plus, Refrigerator, Repeat, Ruler, Search, Send, Settings, Share2, Shield,
  ShieldAlert, Shirt, ShoppingBag, SlidersHorizontal, Sparkles, Star, Store, Sun, Tag, Ticket, Trash2, TrendingDown,
  TrendingUp, Trophy, Undo2, Upload, User, Users, Utensils, Wallet, X, Zap, MessageSquarePlus, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  search: Search, chat: MessageCircle, bell: Bell, heart: Heart, bag: ShoppingBag, user: User, pin: MapPin, plus: Plus, x: X,
  menu: Menu, home: House, compass: Compass, back: ArrowLeft, chev: ChevronRight, down: ChevronDown, up: ChevronUp,
  clock: Clock, shield: Shield, star: Star, arrow: ArrowRight, sun: Sun, moon: Moon, img: ImageIcon, info: Info, check: Check,
  tag: Tag, hammer: Gavel, food: Utensils, list: List, logout: LogOut, grid: LayoutGrid, cal: Calendar, send: Send,
  share: Share2, store: Store, filter: SlidersHorizontal, sort: ArrowUpDown, sparkles: Sparkles, dumbbell: Dumbbell,
  shirt: Shirt, book: BookOpen, laptop: Laptop, bed: BedDouble, fridge: Refrigerator, gift: Gift, music: Music, bike: Bike,
  ticket: Ticket, flame: Flame, pkg: Package, package: Package, packagePlus: PackagePlus, repeat: Repeat, drama: Drama, grad: GraduationCap,
  party: PartyPopper, zap: Zap, camera: Camera, mail: Mail, help: CircleHelp, trend: TrendingDown, trendup: TrendingUp,
  eye: Eye, ruler: Ruler, min: Minus, expand: Maximize2, edit: Pencil, users: Users, wallet: Wallet, key: KeyRound,
  lock: Lock, rupee: IndianRupee, trophy: Trophy, hourglass: Hourglass, layers: Layers, flag: Flag, settings: Settings,
  more: Ellipsis, trash: Trash2, pause: Pause, play: Play, undo: Undo2, alert: CircleAlert, spinner: LoaderCircle,
  grip: GripVertical, upload: Upload, bookmark: Bookmark, filter2: Filter, shieldAlert: ShieldAlert, messagePlus: MessageSquarePlus,
};

export type IconName = keyof typeof MAP | string;

type Props = { name: IconName; className?: string; strokeWidth?: number; filled?: boolean; label?: string };

/**
 * One icon. Decorative by default (aria-hidden); pass `label` when the icon is the only content.
 * @param name prototype icon name, e.g. "hammer"
 */
export function Icon({ name, className = "icon", strokeWidth = 2, filled = false, label }: Props) {
  const C = MAP[name] ?? Package;
  return (
    <C
      className={className}
      strokeWidth={strokeWidth}
      fill={filled ? "currentColor" : "none"}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
