import { AIPrimitiveNodeSchema } from '@shared/aiBuilderSchema';
import { validateEditableSchema, fieldBindingForNode, type EditableField } from '@shared/generative/editable';
import { checkPrimitiveNodeCount, findFunctionalBindings } from '@shared/generative/validation';
import { walkTreeSafe, type PrimitiveNode } from '@shared/generative/nodes';
import { sanitizePrimitiveTree } from '@shared/customComponents';
import { guardResponsive } from './responsiveGuard';

/** New AI sections must survive the same contract the editor uses. */
export function validateGeneratedSection(props: Record<string, unknown>) {
  const parsed = AIPrimitiveNodeSchema.safeParse(props.customTree);
  if (!parsed.success) throw new Error('Invalid native section tree: ' + parsed.error.message);
  const tree = parsed.data as PrimitiveNode;
  if (tree.type !== 'box') throw new Error('Custom section root must be a box.');
  const count = checkPrimitiveNodeCount(tree);
  if (!count.ok) throw new Error(count.guidance);
  const unsafe = findFunctionalBindings(tree);
  if (unsafe.length) throw new Error(unsafe.join(' '));
  const ids = new Set<string>();
  walkTreeSafe(tree, node => {
    if (ids.has(node.id)) throw new Error('Duplicate custom node id: ' + node.id);
    ids.add(node.id);
  });
  const sanitized = sanitizePrimitiveTree(tree);
  if (!sanitized) throw new Error('Custom section could not be sanitized.');
  const schema = validateEditableSchema(sanitized, props.customSchema);
  if (!schema.ok) throw new Error('Custom section needs a valid editable schema: ' + schema.errors.join(' '));
  walkTreeSafe(sanitized, node => {
    const required = node.type === 'button' ? ['text', 'link'] : node.type === 'text' ? ['text'] : node.type === 'image' ? ['image'] : [];
    for (const type of required) {
      const fields = schema.schema.fields.flatMap<EditableField>(field => field.type === 'repeater'
        ? [{ ...field, itemFields: field.itemFields.filter(item => item.type === type) }]
        : field.type === type ? [field] : []);
      if (!fieldBindingForNode(sanitized, { version: 1, fields }, node.id)) throw new Error('Custom content has no ' + type + ' editor binding: ' + node.id);
    }
  });
  const responsive = guardResponsive(sanitized, 'generated section');
  if (responsive.blocking.length) throw new Error(responsive.blocking.join(' '));
  return { ...props, customTree: sanitized, customSchema: schema.schema };
}

export const GENERATED_SECTION_PROMPT = `
NEW NATIVE SECTIONS:
Use type "custom" for a client-specific composition and type "booking" for the trusted booking widget.
A custom section has props.customTree and props.customSchema. Never output HTML, JSX, scripts, forms or invented component types.
customTree nodes: {id,type:"box"|"text"|"image"|"button",name?,styles?,tabletStyles?,mobileStyles?,children?}.
text nodes use text and tag ("h1"|"h2"|"h3"|"p"|"span"); images use src and alt; buttons use label and href.
Use fluid widths, maxWidth, grid/flex with intentional tablet/mobile overrides. Avoid fixed content heights and absolute positioning for text.
customSchema: {version:1,fields:[{key:"heading",label:"Overskrift",type:"text",nodeId:"heading-id"}]}.
Every text/image/button node needs an editor field. Images use type "image"; buttons need both "text" and "link" fields. Expose section colors with type "color", styleKey:"backgroundColor" or "color"; spacing with type "styleGroup", keys:["padding","gap"].
Repeated cards can use a "repeater" field bound to their parent, with itemFields using {key,label,type:"text"|"image"|"link",nodeType:"text"|"image"|"button",nth:0}. Maximum 30 fields.
Bindings must reference real node IDs. Split a whole page into separate manageable sections.
`;
