// The Draco decoder the furniture script reads IKEA's models with: it ships without its types.
declare module "draco3dgltf" {
  const draco3d: {
    createDecoderModule(): Promise<unknown>;
    createEncoderModule(): Promise<unknown>;
  };
  export default draco3d;
}
