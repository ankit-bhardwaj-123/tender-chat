export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface Session {
  user: User;
}

export interface Tender {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
