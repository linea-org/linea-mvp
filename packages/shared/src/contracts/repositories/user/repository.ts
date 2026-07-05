import { NewUser, User } from "./types.js"

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByClerkId(id: string): Promise<User | null>
  findByAPIKey(apiKey: string): Promise<User | null>

  create(payload: NewUser): Promise<User | null>
  update(payload: NewUser): Promise<User | null>
  delete(id: string): Promise<Boolean>
}
