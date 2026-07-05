import { NewPod, Pod } from "./types.js"

export interface PodRepository {
  findById(id: string): Promise<Pod | null>
  create(pod: NewPod): Promise<Pod | null>
  update(pod: NewPod): Promise<Pod | null>
  delete(id: string): Promise<Boolean>
}
