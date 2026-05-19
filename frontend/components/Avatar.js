'use client';

function getInitials(value) {
  return String(value || 'MI').trim().slice(0, 2);
}

export function Avatar({ user, name, className = '', as: Component = 'span', alt = '', ...props }) {
  const label = name || user?.username || 'MI';
  const avatarUrl = user?.avatarUrl || '';
  const classes = `avatar${className ? ` ${className}` : ''}`;

  return (
    <Component className={classes} {...props}>
      {avatarUrl ? <img src={avatarUrl} alt={alt} /> : getInitials(label)}
    </Component>
  );
}
