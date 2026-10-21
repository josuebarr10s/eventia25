export type User = {
  id: number;
  name: string;
  email: string;
  can_create_events: boolean;
  can_edit_events: boolean;
  can_publish_events: boolean;
};
export type Event = {
  id: number;
  title: string;
  description: string;
  category: string;
  category_label: string;
  starts_at: string;
  city: string;
  location: string;
  capacity: number;
  organizer_name: string;
  status: "draft" | "published";
  created_at: string;
  registered_count: number;
  available_spots: number;
  is_registered: boolean;
  can_edit: boolean;
  can_publish: boolean;
  is_demo: boolean;
};
export type Registration = {
  id: number;
  event: Event;
  created_at: string;
  status: "confirmed";
  notification_status: "pending" | "sent" | "console" | "failed";
};
export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
export type Category = { value: string; label: string };
