// src/config/sortOptions.ts
import {
  FolderUp,
  FolderDown,
  ChartNoAxesColumnIncreasingIcon,
  ChartNoAxesColumnDecreasingIcon,
  SortAsc,
  SortDesc,
} from "lucide-react";

// Interface definiran tukaj
export interface SortOptionConfig {
  value: string;
  label: string;
  icon: JSX.Element;
  description: string;
}

// Export konstante
export const sortOptions: SortOptionConfig[] = [
  {
    value: "path-asc",
    label: "Structure (A-Z)",
    icon: <FolderUp size={16} />,
    description: "Structure (A-Z)",
  },
  {
    value: "path-desc",
    label: "Structure (Z-A)",
    icon: <FolderDown size={16} />,
    description: "Structure (Z-A)",
  },
  {
    value: "tokens-asc",
    label: "Tokens (Low to High)",
    icon: <ChartNoAxesColumnIncreasingIcon size={16} />,
    description: "Tokens (Low to High)",
  },
  {
    value: "tokens-desc",
    label: "Tokens (High to Low)",
    icon: <ChartNoAxesColumnDecreasingIcon size={16} />,
    description: "Tokens (High to Low)",
  },
  {
    value: "name-asc",
    label: "Name (A to Z)",
    icon: <SortAsc size={16} />,
    description: "Name (A to Z)",
  },
  {
    value: "name-desc",
    label: "Name (Z to A)",
    icon: <SortDesc size={16} />,
    description: "Name (Z to A)",
  },
];
