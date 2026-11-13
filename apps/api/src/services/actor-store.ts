import { DEMO_ACTORS, type DemoActor } from '@greenflow/shared';

export class ActorStore {
  #activeActorId = 'issuer';

  list(): readonly DemoActor[] {
    return DEMO_ACTORS;
  }

  active(): DemoActor {
    const actor = DEMO_ACTORS.find(({ id }) => id === this.#activeActorId);
    if (!actor) throw new Error('Active demo actor is missing from the registry.');
    return actor;
  }

  select(id: string): DemoActor | undefined {
    const actor = DEMO_ACTORS.find((candidate) => candidate.id === id);
    if (actor) this.#activeActorId = actor.id;
    return actor;
  }

  reset() {
    this.#activeActorId = 'issuer';
  }
}

