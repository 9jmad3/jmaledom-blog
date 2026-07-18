UPDATE comments
SET author_name = split_part(trim(author_name), ' ', 1),
	author_image = NULL
WHERE user_id IS NOT NULL;
