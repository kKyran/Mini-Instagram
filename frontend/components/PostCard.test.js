import { render, screen } from '@testing-library/react';
import { PostCard } from './PostCard';

test('PostCard renders caption, author, tags, and comment count', () => {
  render(<PostCard post={{
    imageUrl: 'https://example.com/a.jpg',
    caption: 'A clean test photo',
    location: 'Astana',
    author: { username: 'tester' },
    commentCount: 2,
    tags: [{ _id: '1', name: 'study', slug: 'study' }]
  }} />);
  expect(screen.getByText('tester')).toBeInTheDocument();
  expect(screen.getByText('A clean test photo')).toBeInTheDocument();
  expect(screen.getByText(/2 comments/)).toBeInTheDocument();
  expect(screen.getByText('#study')).toBeInTheDocument();
});
