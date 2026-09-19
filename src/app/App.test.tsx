import { render, screen } from '@testing-library/react';
import App from '@/app/App';

describe('App', () => {
  it('renders the application wordmark', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Umapi Console' })).toBeInTheDocument();
  });
});