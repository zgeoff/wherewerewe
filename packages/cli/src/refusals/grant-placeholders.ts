// The placeholders of a Run line that asks for the grant's texts, which only the owner's words and
// the agent's reading can fill. Each bullet placeholder says what the owner said in that group.
export const grantPlaceholders = {
  may: '<what the owner allows, in their words>',
  not: '<what the owner did not grant, in their words>',
  never: '<what the owner ruled out, in their words>',
  reading: '<what they cover; what the owner kept back>',
} as const;
