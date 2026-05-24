import { beforeEach, describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { LibraryService } from '../../src/lib/library';
import type { Book, BookStatus, Loan, Member } from '../../src/lib/domain';
import type { LibraryRepository } from '../../src/lib/ports';

const today = new Date('2025-06-10T10:00:00Z');

let repo: MockProxy<LibraryRepository>;
let service: LibraryService;

beforeEach(() => {
  repo = mock<LibraryRepository>();
  service = new LibraryService(repo);
});

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

describe('borrowBook', () => {
  it('permite student emprestar livro disponível', () => {
    // Arrange
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findBookById.mockReturnValue(makeBook());
    repo.findActiveLoansByMemberId.mockReturnValue([]);

    // Act
    const result = service.borrowBook('m1', 'b1', today);

    // Assert
    expect(result.success).toBe(true);
    expect(result.loan?.memberId).toBe('m1');
    expect(result.loan?.bookId).toBe('b1');
  });

  it('bloqueia empréstimo quando livro está em manutenção', () => {
    // Arrange
    repo.findMemberById.mockReturnValue(makeMember({ id: 'm2', name: 'Bob' }));
    repo.findBookById.mockReturnValue(makeBook({ status: 'maintenance' }));

    // Act
    const result = service.borrowBook('m2', 'b1', today);

    // Assert
    expect(result.success).toBe(false);
    expect(result.reason).toBe('BOOK_NOT_AVAILABLE');
  });

  it('bloqueia empréstimo quando livro está emprestado', () => {
    // Arrange
    repo.findMemberById.mockReturnValue(makeMember({ id: 'm2', name: 'Bob' }));
    repo.findBookById.mockReturnValue(makeBook({ status: 'borrowed' }));

    // Act
    const result = service.borrowBook('m2', 'b1', today);

    // Assert
    expect(result.success).toBe(false);
    expect(result.reason).toBe('BOOK_NOT_AVAILABLE');
  });

  it('empréstimo falha quando membro não existe', () => {
    // Arrange
    repo.findMemberById.mockReturnValue(null);

    // Act
    const result = service.borrowBook('fantasma', 'b1', today);

    // Assert
    expect(result.success).toBe(false);
    expect(result.reason).toBe('MEMBER_NOT_FOUND');
  });

  it('empréstimo falha quando livro não existe', () => {
    // Arrange
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findBookById.mockReturnValue(null);

    // Act
    const result = service.borrowBook('m1', 'fantasma', today);

    // Assert
    expect(result.success).toBe(false);
    expect(result.reason).toBe('BOOK_NOT_FOUND');
  });

  it.each([
    {
      tipo: 'student',
      member: { type: 'student' as const },
      loans: [
        { memberId: 'm1', bookId: 'b2', borrowedAt: new Date('2025-06-01T10:00:00Z'), dueAt: new Date('2025-06-20T10:00:00Z'), returnedAt: null },
        { memberId: 'm1', bookId: 'b3', borrowedAt: new Date('2025-06-01T10:00:00Z'), dueAt: new Date('2025-06-20T10:00:00Z'), returnedAt: null },
        { memberId: 'm1', bookId: 'b4', borrowedAt: new Date('2025-06-01T10:00:00Z'), dueAt: new Date('2025-06-20T10:00:00Z'), returnedAt: null },
      ],
    },
    {
      tipo: 'professor',
      member: { type: 'professor' as const },
      loans: [
        { memberId: 'm1', bookId: 'b2', borrowedAt: new Date('2025-06-01T10:00:00Z'), dueAt: new Date('2025-06-20T10:00:00Z'), returnedAt: null },
        { memberId: 'm1', bookId: 'b3', borrowedAt: new Date('2025-06-01T10:00:00Z'), dueAt: new Date('2025-06-20T10:00:00Z'), returnedAt: null },
        { memberId: 'm1', bookId: 'b4', borrowedAt: new Date('2025-06-01T10:00:00Z'), dueAt: new Date('2025-06-20T10:00:00Z'), returnedAt: null },
        { memberId: 'm1', bookId: 'b5', borrowedAt: new Date('2025-06-01T10:00:00Z'), dueAt: new Date('2025-06-20T10:00:00Z'), returnedAt: null },
        { memberId: 'm1', bookId: 'b6', borrowedAt: new Date('2025-06-01T10:00:00Z'), dueAt: new Date('2025-06-20T10:00:00Z'), returnedAt: null },
      ],
    },
  ])('bloqueia empréstimo quando $tipo atinge o limite de empréstimos', ({ member, loans }) => {
    // Arrange
    repo.findMemberById.mockReturnValue(makeMember(member));
    repo.findBookById.mockReturnValue(makeBook());
    repo.findActiveLoansByMemberId.mockReturnValue(loans);

    // Act
    const result = service.borrowBook('m1', 'b1', today);

    // Assert
    expect(result.success).toBe(false);
    expect(result.reason).toBe('LIMIT_REACHED');
  });

  it('bloqueia empréstimo quando membro tem devolução em atraso', () => {
    // Arrange
    const activeLoans: Loan[] = [
      { memberId: 'm1', bookId: 'b2', borrowedAt: new Date('2025-05-25T10:00:00Z'), dueAt: new Date('2025-06-01T10:00:00Z'), returnedAt: null },
    ];
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findBookById.mockReturnValue(makeBook());
    repo.findActiveLoansByMemberId.mockReturnValue(activeLoans);

    // Act
    const result = service.borrowBook('m1', 'b1', today);

    // Assert
    expect(result.success).toBe(false);
    expect(result.reason).toBe('HAS_OVERDUE');
  });

  it('prazo de devolução de student é de 7 dias', () => {
    // Arrange
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findBookById.mockReturnValue(makeBook());
    repo.findActiveLoansByMemberId.mockReturnValue([]);

    // Act
    const result = service.borrowBook('m1', 'b1', today);

    // Assert
    expect(result.loan?.dueAt).toEqual(new Date('2025-06-17T10:00:00Z'));
  });

  it('empréstimo bem-sucedido atualiza status do livro para borrowed', () => {
    // Arrange
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findBookById.mockReturnValue(makeBook());
    repo.findActiveLoansByMemberId.mockReturnValue([]);

    // Act
    service.borrowBook('m1', 'b1', today);

    // Assert
    expect(repo.saveBook).toHaveBeenCalledWith(expect.objectContaining({ status: 'borrowed' }));
  });

  it('prazo de devolução de professor é de 14 dias', () => {
    // Arrange
    repo.findMemberById.mockReturnValue(makeMember({ type: 'professor' }));
    repo.findBookById.mockReturnValue(makeBook());
    repo.findActiveLoansByMemberId.mockReturnValue([]);

    // Act
    const result = service.borrowBook('m1', 'b1', today);

    // Assert
    expect(result.loan?.dueAt).toEqual(new Date('2025-06-24T10:00:00Z'));
  });
});

describe('returnBook', () => {
  it('calcula multa de 2 dias atrasado para student', () => {
    // Arrange
    const loan = {
      memberId: 'm1',
      bookId: 'b1',
      borrowedAt: new Date('2025-06-01T10:00:00Z'),
      dueAt: new Date('2025-06-08T10:00:00Z'),
      returnedAt: null,
    };
    repo.findActiveLoanByBookId.mockReturnValue(loan);
    repo.findBookById.mockReturnValue(makeBook());

    // Act
    const result = service.returnBook(
      'm1',
      'b1',
      new Date('2025-06-10T10:00:00Z'),
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.daysLate).toBe(2);
    expect(result.feeInCents).toBe(400);
  });

  it.each([
    { daysLate: 3, dueAt: '2025-06-07T10:00:00Z', returnedAt: '2025-06-10T10:00:00Z', feeInCents: 600 },
    { daysLate: 4, dueAt: '2025-06-06T10:00:00Z', returnedAt: '2025-06-10T10:00:00Z', feeInCents: 1100 },
    { daysLate: 5, dueAt: '2025-06-08T10:00:00Z', returnedAt: '2025-06-13T10:00:00Z', feeInCents: 1600 },
  ])('multa com $daysLate dias de atraso é de $feeInCents centavos', ({ daysLate, dueAt, returnedAt, feeInCents }) => {
    // Arrange
    const loan: Loan = {
      memberId: 'm1',
      bookId: 'b1',
      borrowedAt: new Date('2025-06-01T10:00:00Z'),
      dueAt: new Date(dueAt),
      returnedAt: null,
    };
    repo.findActiveLoanByBookId.mockReturnValue(loan);
    repo.findBookById.mockReturnValue(makeBook());

    // Act
    const result = service.returnBook('m1', 'b1', new Date(returnedAt));

    // Assert
    expect(result.daysLate).toBe(daysLate);
    expect(result.feeInCents).toBe(feeInCents);
  });

  it('devolução falha quando livro não está emprestado', () => {
    // Arrange
    repo.findActiveLoanByBookId.mockReturnValue(null);
    // Act
    const result = service.returnBook('m1', 'b1', today);

    // Assert
    expect(result.success).toBe(false);
    expect(result.reason).toBe('LOAN_NOT_FOUND');
  });

  it('devolução falha quando livro está emprestado para outro membro', () => {
    // Arrange
    const loan: Loan = {
      memberId: 'outro',
      bookId: 'b1',
      borrowedAt: new Date('2025-06-01T10:00:00Z'),
      dueAt: new Date('2025-06-08T10:00:00Z'),
      returnedAt: null,
    };
    repo.findActiveLoanByBookId.mockReturnValue(loan);

    // Act
    const result = service.returnBook('m1', 'b1', today);

    // Assert
    expect(result.success).toBe(false);
    expect(result.reason).toBe('NOT_BORROWER');
  });

  it('devolução no prazo não gera multa', () => {
    // Arrange
    const loan: Loan = {
      memberId: 'm1',
      bookId: 'b1',
      borrowedAt: new Date('2025-06-01T10:00:00Z'),
      dueAt: today,
      returnedAt: null,
    };
    repo.findActiveLoanByBookId.mockReturnValue(loan);
    repo.findBookById.mockReturnValue(makeBook());

    // Act
    const result = service.returnBook('m1', 'b1', today);

    // Assert
    expect(result.success).toBe(true);
    expect(result.daysLate).toBe(0);
    expect(result.feeInCents).toBe(0);
  });

  it('devolução bem-sucedida persiste returnedAt e libera o livro', () => {
    // Arrange
    const loan: Loan = {
      memberId: 'm1',
      bookId: 'b1',
      borrowedAt: new Date('2025-06-01T10:00:00Z'),
      dueAt: today,
      returnedAt: null,
    };
    repo.findActiveLoanByBookId.mockReturnValue(loan);
    repo.findBookById.mockReturnValue(makeBook());

    // Act
    service.returnBook('m1', 'b1', today);

    // Assert
    expect(repo.saveLoan).toHaveBeenCalledWith(expect.objectContaining({ returnedAt: today }));
    expect(repo.saveBook).toHaveBeenCalledWith(expect.objectContaining({ status: 'available' }));
  });
});

describe('getMemberStatus', () => {
  it('getMemberStatus para membro inexistente', () => {
    // Arrange
    repo.findMemberById.mockReturnValue(null);

    // Act
    const status = () => service.getMemberStatus('m999', today);

    // Assert
    expect(status).toThrow('MEMBER_NOT_FOUND');
  });

  it('status do membro reflete corretamente loans ativos e em atraso', () => {
    // Arrange
    repo.findMemberById.mockReturnValue(makeMember());
    repo.findActiveLoansByMemberId.mockReturnValue([
      { memberId: 'm1', bookId: 'b2', borrowedAt: new Date('2025-06-01T10:00:00Z'), dueAt: new Date('2025-06-01T10:00:00Z'), returnedAt: null },
      { memberId: 'm1', bookId: 'b3', borrowedAt: new Date('2025-06-01T10:00:00Z'), dueAt: new Date('2025-06-20T10:00:00Z'), returnedAt: null },
    ]);

    // Act
    const status = service.getMemberStatus('m1', today);

    // Assert
    expect(status.activeLoans).toBe(2);
    expect(status.overdueLoans).toBe(1);
    expect(status.remainingSlots).toBe(1);
    expect(status.canBorrow).toBe(false);
  });
});