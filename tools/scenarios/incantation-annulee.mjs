/**
 * Bogue signalé le 2026-10-13 : un sort à zone dont on **annule** la pose laissait tourner l'incantation persistante de BLFX sur le
 * lanceur (animation et son, que BLFX n'arrête qu'à la pose). runtime/casting.mjs l'arrête quand aucune zone n'est posée et que le
 * moteur ne vise plus rien.
 *  1. Une incantation nommée comme BLFX la nomme (`Video-<item>-<token>`) sur l'Ensorceleur, puis une utilisation de Mains brûlantes
 *     sans zone posée : l'incantation s'arrête d'elle-même en quelques secondes.
 *  2. Zone posée tout de suite, incantation démarrée **après** (le son retardé de BLFX quand le moteur pose la zone dès l'utilisation :
 *     Éclair, signalé sur le Discord le 2026-11-17) : l'incantation est arrêtée quand même, peu après.
 * Sans BLFX : non applicable.
 */
const MODULE = "darsh-animations";
const pause = ms => new Promise(r => setTimeout(r, ms));
const CAST = "blfx.spell.cast.circles1.energy1.blue";

export default {
  name: "incantation annulée — l'incantation de BLFX s'arrête quand la pose est annulée, ou quand la zone est posée avant elle",

  async run(ctx) {
    const api = async (fn, args={}) => (await ctx.call("call-module-api", { moduleId: MODULE, fn, args, waitMs: 8000 })).result;
    if ( (await api("renderer")) !== "blfx" ) { ctx.log("BLFX inactif : non applicable"); return; }
    const { tokens, sceneId } = await ctx.scene();
    if ( !tokens.some(t => t.name === "Ensorceleur") ) { ctx.log("Ensorceleur absent : non applicable"); return; }
    const sorc = await ctx.token("Ensorceleur");

    // 1. Pose annulée.
    const one = await api("previewCancelledCast", { tokenId: sorc.id, identifier: "burning-hands", animation: CAST });
    ctx.restore(() => api("castingEffects", { name: one.name, end: true }));
    ctx.expect(one.before === 1 && !!one.decided?.watching, `incantation jouée et surveillée (${JSON.stringify(one.decided)})`);
    let left = 1;
    for ( let s = 0; (s < 8) && left; s++ ) { await pause(1000); left = (await api("castingEffects", { name: one.name })).count; }
    ctx.expect(left === 0, "pose annulée : l'incantation s'arrête");

    // 2. Zone posée d'abord, incantation démarrée après : arrêtée quand même (second arrêt après la création de la région).
    const box = await ctx.box(sorc);
    const region = await ctx.call("create-region", { sceneId, name: "Zone (essai)",
      shapes: [{ type: "rectangle", x: box.x + box.width, y: box.y, width: box.width * 2, height: box.height }],
      regionData: { flags: { dnd5e: { activity: one.activity, origin: `Scene.${sceneId}.Token.${sorc.id}` } } } });
    const regionId = region?.id ?? region?.regionId;
    ctx.restore(() => ctx.call("delete-scene-object", { type: "Region", objectId: regionId }).catch(() => {}));
    await pause(500);
    const two = await api("previewCancelledCast", { tokenId: sorc.id, identifier: "burning-hands", animation: CAST, watch: false });
    ctx.restore(() => api("castingEffects", { name: two.name, end: true }));
    ctx.expect(two.before === 1 && !two.decided?.watching, `incantation jouée après la pose, sans surveillance (${two.before} effet)`);
    left = 1;
    for ( let s = 0; (s < 6) && left; s++ ) { await pause(1000); left = (await api("castingEffects", { name: two.name })).count; }
    ctx.expect(left === 0, "zone posée avant l'incantation retardée : l'incantation s'arrête quand même");
  }
};
