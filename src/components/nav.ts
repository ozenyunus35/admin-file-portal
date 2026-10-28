import { Activity, Building2, FolderKanban, FolderOpen, LayoutDashboard, Settings, Users } from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, admin: false, group: "Workspace" },
  { href: "/projects", label: "Projects", icon: FolderKanban, admin: false, group: "Workspace" },
  { href: "/files", label: "Files", icon: FolderOpen, admin: false, group: "Workspace" },
  { href: "/clients", label: "Clients", icon: Building2, admin: true, group: "Admin" },
  { href: "/users", label: "Users", icon: Users, admin: true, group: "Admin" },
  { href: "/activity", label: "Activity log", icon: Activity, admin: true, group: "Admin" },
  { href: "/settings", label: "Settings", icon: Settings, admin: false, group: "Account" },
];
