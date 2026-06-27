import { hashPassword, verifyPassword } from './password';

export interface User {
  id: string;
  username: string;
  role: string;
  displayName: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role?: string;
  displayName?: string;
}

export type SeedUser = CreateUserInput;

export interface UserStore {
  verify(username: string, password: string): Promise<User | null>;
  list(): Promise<User[]>;
  create(input: CreateUserInput): Promise<User>;
  updateRole(id: string, role: string): Promise<User | null>;
  remove(id: string): Promise<boolean>;
  changePassword(username: string, currentPassword: string, newPassword: string): Promise<boolean>;
}

interface StoredUser extends User {
  passwordHash: string;
}

const strip = (user: StoredUser): User => ({
  id: user.id,
  username: user.username,
  role: user.role,
  displayName: user.displayName,
});

export async function createInMemoryUserStore(seed: SeedUser[]): Promise<UserStore> {
  const byId = new Map<string, StoredUser>();
  let counter = 0;

  async function add(input: CreateUserInput): Promise<StoredUser> {
    counter += 1;
    const stored: StoredUser = {
      id: `user-${counter}`,
      username: input.username,
      role: input.role ?? 'dispatcher',
      displayName: input.displayName ?? input.username,
      passwordHash: await hashPassword(input.password),
    };
    byId.set(stored.id, stored);
    return stored;
  }

  for (const entry of seed) {
    await add(entry);
  }

  const byUsername = (username: string): StoredUser | undefined =>
    [...byId.values()].find((user) => user.username === username);

  return {
    async verify(username, password) {
      const user = byUsername(username);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return null;
      }
      return strip(user);
    },
    async list() {
      return [...byId.values()].map(strip);
    },
    async create(input) {
      if (byUsername(input.username)) {
        throw new Error('username taken');
      }
      return strip(await add(input));
    },
    async updateRole(id, role) {
      const user = byId.get(id);
      if (!user) {
        return null;
      }
      user.role = role;
      return strip(user);
    },
    async remove(id) {
      return byId.delete(id);
    },
    async changePassword(username, currentPassword, newPassword) {
      const user = byUsername(username);
      if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
        return false;
      }
      user.passwordHash = await hashPassword(newPassword);
      return true;
    },
  };
}
