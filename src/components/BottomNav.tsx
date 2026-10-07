import { ClipboardList, Home, MoreHorizontal, Users, FilePlus2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/tasks', label: 'Tasks', icon: ClipboardList },
  { to: '/report', label: 'Report', icon: FilePlus2 },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/more', label: 'More', icon: MoreHorizontal }
] as const;

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Staff primary navigation">
      <div className="bottom-nav-inner">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon className="nav-icon" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
