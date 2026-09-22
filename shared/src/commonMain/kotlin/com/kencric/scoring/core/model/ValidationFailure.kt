package com.kencric.scoring.core.model

/** Which of live-scoring.md §5's eleven validation rules was violated. */
enum class ValidationRule {
    V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11,
}

/**
 * A specific, field-attributed rejection -- never a generic error,
 * per ux-specification.md §2.2 and this task's own Expected behavior.
 */
data class ValidationFailure(
    val rule: ValidationRule,
    val message: String,
)

sealed class ValidationResult {
    data class Valid(val input: DeliveryInput) : ValidationResult()
    data class Invalid(val failures: List<ValidationFailure>) : ValidationResult()
}
