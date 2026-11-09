/**
 * The id namespace of one mounted app.
 *
 * The host may mount this bundle into more than one slot, and the panel
 * binds `<label for>` to control `id`s. A shared namespace would make the
 * second mount's label point at the *first* mount's control, so every
 * mount takes a prefix of its own and the ids are built from it.
 *
 * The counter is per bundle instance. The host loads the bundle once and
 * mounts it as often as it likes, so the mounts of one page differ; a
 * second copy of the bundle on the same page would need a random part as
 * well.
 */
let mounts = 0

export function nextIdPrefix(): string {
    mounts += 1
    return `usage-${mounts}`
}
