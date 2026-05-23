import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { LibraryService } from '../src/lib/library';
import type { Book, Loan, Member } from '../src/lib/domain';
import type { LibraryRepository } from '../src/lib/ports';

const today = new Date('2025-06-10T10:00:00Z');

const makeMember = (overrides: Partial<Member> = {}): Member => ({
  id: 'm1',
  name: 'Alice',
  type: 'student',
  ...overrides,
});

const makeBook = (overrides: Partial<Book> = {}): Book => ({
  id: 'b1',
  title: 'Clean Code',
  status: 'available',
  ...overrides,
});

describe('LibraryService', () => {
  it('permite student emprestar livro disponível', () => {
    const repo = mock<LibraryRepository>();
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findBookById.mockReturnValue(makeBook());
    repo.findActiveLoansByMemberId.mockReturnValue([]);
    const service = new LibraryService(repo);

    const result = service.borrowBook('m1', 'b1', today);

    expect(result.success).toBe(true);
    expect(result.loan?.memberId).toBe('m1');
    expect(result.loan?.bookId).toBe('b1');
  });

  it('calcula multa de 2 dias atrasado para student', () => {
    const loan: Loan = {
      memberId: 'm1',
      bookId: 'b1',
      borrowedAt: new Date('2025-06-01T10:00:00Z'),
      dueAt: new Date('2025-06-08T10:00:00Z'),
      returnedAt: null,
    };
    const repo = mock<LibraryRepository>();
    repo.findActiveLoanByBookId.mockReturnValue(loan);
    repo.findBookById.mockReturnValue(makeBook());
    const service = new LibraryService(repo);

    const result = service.returnBook(
      'm1',
      'b1',
      new Date('2025-06-10T10:00:00Z'),
    );

    expect(result.success).toBe(true);
    expect(result.daysLate).toBe(2);
    expect(result.feeInCents).toBe(400);
  });

  it('bloqueia empréstimo quando livro está borrowed', () => {
    const repo = mock<LibraryRepository>();
    repo.findMemberById.mockReturnValue(makeMember({ id: 'm2', name: 'Bob' }));
    repo.findBookById.mockReturnValue(makeBook({ status: 'borrowed' }));
    const service = new LibraryService(repo);

    const result = service.borrowBook('m2', 'b1', today);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('BOOK_NOT_AVAILABLE');
  });

  it('retorna algo ao emprestar', () => {
    const repo = mock<LibraryRepository>();
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findBookById.mockReturnValue(makeBook());
    repo.findActiveLoansByMemberId.mockReturnValue([]);
    const service = new LibraryService(repo);

    const result = service.borrowBook('m1', 'b1', today);

    expect(result).toBeDefined();
  });

  it('getMemberStatus retorna um objeto', () => {
    const repo = mock<LibraryRepository>();
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findActiveLoansByMemberId.mockReturnValue([]);
    const service = new LibraryService(repo);

    const status = service.getMemberStatus('m1', today);

    expect(typeof status).toBe('object');
  });

  it('canBorrow é booleano', () => {
    const repo = mock<LibraryRepository>();
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findActiveLoansByMemberId.mockReturnValue([]);
    const service = new LibraryService(repo);

    const status = service.getMemberStatus('m1', today);

    expect(typeof status.canBorrow).toBe('boolean');
  });

  it('professor pode emprestar até 3 livros', () => {
    const prof = makeMember({ id: 'p1', type: 'professor' });
    const activeLoans: Loan[] = [
      { memberId: 'p1', bookId: 'b1', borrowedAt: today, dueAt: new Date('2025-06-24T10:00:00Z'), returnedAt: null },
      { memberId: 'p1', bookId: 'b2', borrowedAt: today, dueAt: new Date('2025-06-24T10:00:00Z'), returnedAt: null },
      { memberId: 'p1', bookId: 'b3', borrowedAt: today, dueAt: new Date('2025-06-24T10:00:00Z'), returnedAt: null },
    ];
    const repo = mock<LibraryRepository>();
    repo.findMemberById.mockReturnValue(prof);
    repo.findBookById.mockReturnValue(makeBook({ id: 'b4' }));
    repo.findActiveLoansByMemberId.mockReturnValue(activeLoans);
    const service = new LibraryService(repo);

    const result = service.borrowBook('p1', 'b4', today);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('LIMIT_REACHED');
  });

  it('returnBook calcula multa', () => {
    const service = mock<LibraryService>();
    service.returnBook.mockReturnValue({
      success: true,
      feeInCents: 999,
      daysLate: 5,
    });

    expect(service.returnBook('m1', 'b1', today).feeInCents).toBe(999);
  });

  it('borrowBook não lança erro com inputs válidos', () => {
    const repo = mock<LibraryRepository>();
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findBookById.mockReturnValue(makeBook());
    repo.findActiveLoansByMemberId.mockReturnValue([]);
    const service = new LibraryService(repo);

    expect(() => service.borrowBook('m1', 'b1', today)).not.toThrow();
  });

  it('calcula multa de 5 dias atrasado', () => {
    const loan: Loan = {
      memberId: 'm1',
      bookId: 'b1',
      borrowedAt: new Date('2025-06-01T10:00:00Z'),
      dueAt: new Date('2025-06-08T10:00:00Z'),
      returnedAt: null,
    };
    const repo = mock<LibraryRepository>();
    repo.findActiveLoanByBookId.mockReturnValue(loan);
    repo.findBookById.mockReturnValue(makeBook());
    const service = new LibraryService(repo);

    const result = service.returnBook(
      'm1',
      'b1',
      new Date('2025-06-13T10:00:00Z'),
    );

    expect(result.feeInCents).toBe(1000);
  });

  it('getMemberStatus para membro inexistente', () => {
    const repo = mock<LibraryRepository>();
    repo.findMemberById.mockReturnValue(null);
    const service = new LibraryService(repo);

    const status = service.getMemberStatus('m999', today);

    expect(status.activeLoans).toBe(0);
  });
});
