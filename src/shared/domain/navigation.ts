export type AppRoute = {
  path: string;
  label: string;
  shortLabel: string;
  description: string;
};

export const APP_ROUTES: AppRoute[] = [
  {
    path: '/',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    description: 'Your preparation at a glance',
  },
  {
    path: '/planner',
    label: 'Study Planner',
    shortLabel: 'Planner',
    description: 'Plan focused study and revision sessions',
  },
  {
    path: '/syllabus',
    label: 'Syllabus',
    shortLabel: 'Syllabus',
    description: 'Track every topic from start to revision',
  },
  {
    path: '/tests',
    label: 'PYQs & Mock Tests',
    shortLabel: 'Tests',
    description: 'Practice in a focused GATE-style environment',
  },
  {
    path: '/results',
    label: 'Results',
    shortLabel: 'Results',
    description: 'Turn every attempt into a better next step',
  },
  {
    path: '/tutor',
    label: 'AI Tutor',
    shortLabel: 'AI Tutor',
    description: 'Learn with a private, locally running assistant',
  },
];

export const getRouteByPath = (pathname: string) =>
  APP_ROUTES.find((route) => route.path === pathname) ??
  (pathname.startsWith('/tests/') || pathname.startsWith('/attempt/')
    ? APP_ROUTES.find((route) => route.path === '/tests')
    : undefined) ??
  APP_ROUTES[0];
