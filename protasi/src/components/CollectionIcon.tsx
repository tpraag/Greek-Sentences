import {
  Utensils, Coffee, Wine, Pizza, Apple, Cake,
  MapPin, Plane, Car, Train, Hotel, Compass,
  Users, Heart, Smile, Handshake, Baby, User,
  Sun, TreePine, Flower, Mountain, Waves, Cloud,
  Home, ShoppingBag, Shirt, Bed, Bath, Tv,
  Book, GraduationCap, Briefcase, Pen, Calculator, Globe,
  Activity, Stethoscope, Pill, Dumbbell, Bike, PersonStanding,
  Music, Camera, Film, Palette, Gamepad2, Theater,
  Clock, Calendar, Star, Flag, Bell, Gift,
  Folder, Tag, Bookmark, MessageCircle, Phone, Mail,
  type LucideProps,
} from 'lucide-react'
import type { IconName } from '../types'

const ICON_MAP: Record<IconName, React.ComponentType<LucideProps>> = {
  utensils: Utensils, coffee: Coffee, wine: Wine, pizza: Pizza, apple: Apple, cake: Cake,
  'map-pin': MapPin, plane: Plane, car: Car, train: Train, hotel: Hotel, compass: Compass,
  users: Users, heart: Heart, smile: Smile, handshake: Handshake, baby: Baby, user: User,
  sun: Sun, tree: TreePine, flower: Flower, mountain: Mountain, waves: Waves, cloud: Cloud,
  home: Home, 'shopping-bag': ShoppingBag, shirt: Shirt, bed: Bed, bath: Bath, tv: Tv,
  book: Book, 'graduation-cap': GraduationCap, briefcase: Briefcase, pen: Pen, calculator: Calculator, globe: Globe,
  activity: Activity, stethoscope: Stethoscope, pill: Pill, dumbbell: Dumbbell, bike: Bike, running: PersonStanding,
  music: Music, camera: Camera, film: Film, palette: Palette, game: Gamepad2, theater: Theater,
  clock: Clock, calendar: Calendar, star: Star, flag: Flag, bell: Bell, gift: Gift,
  folder: Folder, tag: Tag, bookmark: Bookmark, message: MessageCircle, phone: Phone, mail: Mail,
}

interface Props {
  icon: IconName
  accent: string
  size?: number
}

export default function CollectionIcon({ icon, accent, size = 22 }: Props) {
  const Icon = ICON_MAP[icon] ?? Folder
  return <Icon size={size} color={accent} strokeWidth={1.75} />
}
