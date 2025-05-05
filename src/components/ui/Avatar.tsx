import React from 'react';
import { User } from '../../types';
import { cn } from '../../lib/utils';

type AvatarProps = {
  user?: User;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const Avatar: React.FC<AvatarProps> = ({ user, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  if (!user) {
    return (
      <div
        className={cn(
          'rounded-full bg-slate-300 flex items-center justify-center text-slate-600',
          sizeClasses[size],
          className
        )}
      >
        <span>?</span>
      </div>
    );
  }

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name || user.email}
        className={cn('rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }

  // Get initials from name or email
  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : user.email.substring(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'rounded-full bg-blue-600 flex items-center justify-center text-white font-medium',
        sizeClasses[size],
        className
      )}
    >
      <span>{initials}</span>
    </div>
  );
};

export default Avatar;