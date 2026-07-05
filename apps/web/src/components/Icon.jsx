import {
  MapPin,
  GraduationCap,
  Layers,
  Code,
  Mail,
  Linkedin,
  Github,
  Twitter,
  Link as LinkIcon,
  Terminal,
  Boxes,
  Database,
  ShieldCheck,
  BookOpen,
  PlayCircle,
  Globe,
  BrainCircuit,
} from "lucide-react";

// Explicit registry of the icons referenced by name in canonical content
// (profile facts/socials, capability categories, project links). Using named
// imports keeps only these icons in the bundle and avoids lucide-react/dynamic,
// which otherwise emits a lazy chunk for every icon in the set.
const registry = {
  "map-pin": MapPin,
  "graduation-cap": GraduationCap,
  layers: Layers,
  code: Code,
  mail: Mail,
  linkedin: Linkedin,
  github: Github,
  twitter: Twitter,
  link: LinkIcon,
  terminal: Terminal,
  boxes: Boxes,
  database: Database,
  "shield-check": ShieldCheck,
  "book-open": BookOpen,
  "play-circle": PlayCircle,
  globe: Globe,
  "brain-circuit": BrainCircuit,
};

export const Icon = ({ name, ...props }) => {
  const Cmp = registry[name] || LinkIcon;
  return <Cmp {...props} />;
};
