export type Member = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  gender: string | null;
  birthdate: string | null;
  membership_status: string;
  member_type: string;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
};

export type MembershipStatus = "all" | "active" | "inactive" | "visitor" | "new";
export type SortOption = "name-az" | "name-za" | "newest" | "oldest";
