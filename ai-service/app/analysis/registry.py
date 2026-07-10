import inspect
import logging

from app.analysis.analyzer import AnalysisContext, RawFinding
from app.analysis.dependency import CircularDependencyAnalyzer, DependencyDepthAnalyzer, ModuleCouplingAnalyzer, UnsafeDependencyAnalyzer
from app.analysis.patterns import DesignPatternDetector
from app.analysis.performance import BlockingOperationAnalyzer, ExpensiveLoopAnalyzer, NPlusOneAnalyzer
from app.analysis.quality import (
    ClassSizeAnalyzer,
    ComplexityAnalyzer,
    DuplicateLogicAnalyzer,
    FileSizeAnalyzer,
    FunctionSizeAnalyzer,
    NestingDepthAnalyzer,
    UnusedImportAnalyzer,
)
from app.analysis.security import (
    HardcodedSecretAnalyzer,
    MissingAuthorizationAnalyzer,
    SensitiveDataLoggingAnalyzer,
    SqlInjectionAnalyzer,
    WeakTlsAnalyzer,
)
from app.analysis.solid import DipCandidateAnalyzer, SrpCandidateAnalyzer

logger = logging.getLogger(__name__)

_ANALYZERS = [
    ComplexityAnalyzer(),
    FunctionSizeAnalyzer(),
    ClassSizeAnalyzer(),
    NestingDepthAnalyzer(),
    FileSizeAnalyzer(),
    DuplicateLogicAnalyzer(),
    UnusedImportAnalyzer(),
    HardcodedSecretAnalyzer(),
    SqlInjectionAnalyzer(),
    WeakTlsAnalyzer(),
    SensitiveDataLoggingAnalyzer(),
    MissingAuthorizationAnalyzer(),
    NPlusOneAnalyzer(),
    BlockingOperationAnalyzer(),
    ExpensiveLoopAnalyzer(),
    CircularDependencyAnalyzer(),
    ModuleCouplingAnalyzer(),
    DependencyDepthAnalyzer(),
    UnsafeDependencyAnalyzer(),
    SrpCandidateAnalyzer(),
    DipCandidateAnalyzer(),
    DesignPatternDetector(),
]


async def run_all(context: AnalysisContext) -> list[RawFinding]:
    """Runs every registered analyzer, isolating failures so one broken
    analyzer can't take down the whole analysis run. Adding a new analyzer
    means appending it to _ANALYZERS above - nothing else changes."""
    findings: list[RawFinding] = []
    for analyzer in _ANALYZERS:
        try:
            result = analyzer.analyze(context)
            if inspect.isawaitable(result):
                result = await result
            findings.extend(result)
        except Exception:
            logger.exception("Analyzer %s failed", analyzer.name)
    return findings
