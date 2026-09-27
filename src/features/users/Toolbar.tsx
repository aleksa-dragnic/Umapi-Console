import { USER_STATUSES, type UserStatus } from '@/features/users/url-state';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';

/**
 * The directory's toolbar (inventory section 3.3). It stays interactive while
 * the table loads. The search term is shown as typed; the screen debounces it
 * before it reaches the address bar and the API.
 */

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...USER_STATUSES.map((status) => ({ value: status, label: status })),
];

export function Toolbar({
  term,
  onTermChange,
  status,
  onStatusChange,
}: {
  term: string;
  onTermChange: (term: string) => void;
  status: UserStatus | null;
  onStatusChange: (status: UserStatus | null) => void;
}) {
  return (
    <div role="search" className="flex flex-wrap items-end gap-app-3">
      <div className="min-w-0 flex-1 basis-64">
        <Input
          label="Search"
          type="search"
          placeholder="Email, first name or last name"
          value={term}
          onChange={(event) => onTermChange(event.target.value)}
          onKeyDown={(event) => {
            // Inventory section 4: Escape clears the search. Stated rather than
            // left to the browser, because not every browser clears a search
            // field on Escape, and the inspector takes the key first when open.
            if (event.key !== 'Escape' || term === '') return;
            event.preventDefault();
            onTermChange('');
          }}
        />
      </div>
      <div className="w-48">
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={status ?? ''}
          onChange={(event) =>
            onStatusChange(USER_STATUSES.find((value) => value === event.target.value) ?? null)
          }
        />
      </div>
    </div>
  );
}
