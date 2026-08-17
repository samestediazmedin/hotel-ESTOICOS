import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';
import { ConciergeController } from './concierge.controller';

const mockSvc = {
  streamChat: vi.fn().mockReturnValue(of({ data: '{"type":"message_stop","finishReason":"stop"}' })),
};

function buildController(): ConciergeController {
  return new ConciergeController(mockSvc as any);
}

describe('ConciergeController.chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSvc.streamChat.mockReturnValue(
      of({ data: '{"type":"message_stop","finishReason":"stop"}' }),
    );
  });

  /**
   * Test 1: missing message field → ZodError → BadRequestException thrown.
   *
   * The controller reads the query string from req.query (not @Query() decorator),
   * so the request object now also carries the (possibly empty) query.
   */
  it('throws BadRequestException when query has no message field', () => {
    const controller = buildController();
    const req = { ip: '1.2.3.4', query: {} } as any;

    expect(() => controller.chat(req)).toThrow(BadRequestException);
    expect(mockSvc.streamChat).not.toHaveBeenCalled();
  });

  /**
   * Test 2: valid query → svc.streamChat called once with sanitized args.
   */
  it('calls svc.streamChat with message, ip, and sessionCookie on valid query', () => {
    const controller = buildController();
    const req = {
      ip: '5.6.7.8',
      query: { message: 'Recomiéndame un café cercano', sessionCookie: 'sess-abc' },
    } as any;

    const result = controller.chat(req);

    expect(mockSvc.streamChat).toHaveBeenCalledOnce();
    const [msg, ip, cookie] = mockSvc.streamChat.mock.calls[0];
    expect(msg).toBe('Recomiéndame un café cercano');
    expect(ip).toBe('5.6.7.8');
    expect(cookie).toBe('sess-abc');

    // Returns an Observable
    expect(result).toBeDefined();
  });
});
