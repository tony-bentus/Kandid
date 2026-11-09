import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('returns the API metadata', () => {
    const controller = new AppController();

    expect(controller.getInfo()).toEqual({
      name: 'Kandid API',
      version: '0.1.0',
      docs: '/docs',
      health: '/v1/health',
    });
  });
});
